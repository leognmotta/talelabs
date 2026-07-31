/**
 * Certifies recovery after Stripe succeeds before local subscription-change
 * projection commits.
 */

import type { StripeClient } from '@talelabs/stripe'
import type { Kysely } from 'kysely'

import type { Database } from '../src/schema.js'

import {
  BILLING_CATALOG,
  getBillingOffer,
  proratedUpgradeCredits,
} from '@talelabs/billing'
import { subscriptionChangeScheduleMetadata } from '@talelabs/stripe'

import {
  seedCreatorMonthlySubscription,
} from './billing-subscription-change-verifier.js'
import { invariant } from './billing-verifier-support.js'

type BillingAccounting = typeof import('../src/index.js')
type SubscriptionChangeRecoveryActions = typeof import(
  '../../../apps/api/src/domain/billing/subscription-change-intent.service.js'
) & typeof import(
  '../../../apps/api/src/domain/billing/subscription-change-replay.service.js'
) & typeof import(
  '../../../apps/api/src/domain/billing/subscription-change-schedule.service.js'
) & typeof import(
  '../../../packages/trigger/src/billing/stripe-subscription-changes.js'
)

function toUnixSeconds(value: Date) {
  return Math.floor(value.getTime() / 1_000)
}

function stripePrice(
  id: string,
  planCode: 'creator' | 'pro',
  recurringOptionCode: string,
  billingInterval: 'month' | 'year',
) {
  const resolved = getBillingOffer({
    billingInterval,
    planCode,
    recurringOptionCode,
  })!
  return {
    currency: 'usd',
    id,
    livemode: false,
    lookup_key: resolved.offer.stripeLookupKey,
    metadata: {
      talelabs_catalog_revision: resolved.offer.catalogRevision,
      talelabs_monthly_credits: String(resolved.option.monthlyCredits),
      talelabs_offer_code: resolved.offer.offerCode,
      talelabs_plan_code: planCode,
      talelabs_recurring_option_code: recurringOptionCode,
    },
    recurring: { interval: billingInterval },
    unit_amount: resolved.offer.priceUsdCents,
  }
}

function interruptSubscriptionProjection(database: Kysely<Database>) {
  return new Proxy(database, {
    get(target, property) {
      if (property === 'isTransaction')
        return true
      if (property === 'updateTable') {
        return (table: string) => {
          if (table === 'billingSubscriptions')
            throw new Error('simulated_projection_interruption')
          return target.updateTable(table as never)
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as unknown as Kysely<Database>
}

async function verifyScheduleCreateInterruption(
  database: Kysely<Database>,
  actions: SubscriptionChangeRecoveryActions,
  accounting: BillingAccounting,
) {
  const organizationId
    = 'billing-org-zz-subscription-schedule-create-recovery'
  await seedCreatorMonthlySubscription(
    organizationId,
    'schedule_create_recovery',
    database,
    accounting,
  )
  const pro = getBillingOffer({
    billingInterval: 'month',
    planCode: 'pro',
    recurringOptionCode: 'pro-5300',
  })!
  await Promise.all([
    database.updateTable('billingSubscriptions')
      .set({
        catalogRevision: pro.offer.catalogRevision,
        offerCode: pro.offer.offerCode,
        planCode: 'pro',
        recurringOptionCode: pro.option.code,
      })
      .where('organizationId', '=', organizationId)
      .execute(),
    database.updateTable('organizationBillingAccounts')
      .set({
        catalogRevision: pro.offer.catalogRevision,
        currentOfferCode: pro.offer.offerCode,
        currentPlanCode: 'pro',
        currentRecurringOptionCode: pro.option.code,
      })
      .where('organizationId', '=', organizationId)
      .execute(),
  ])
  const local = await database.selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  const target = getBillingOffer({
    billingInterval: 'month',
    planCode: 'creator',
    recurringOptionCode: 'creator-1600',
  })!
  const currentPrice = stripePrice(
    'price_create_recovery_pro',
    'pro',
    pro.option.code,
    'month',
  )
  const targetPrice = stripePrice(
    'price_create_recovery_creator',
    'creator',
    target.option.code,
    'month',
  )
  const admitted = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'renewal',
    idempotencyKey: 'schedule-create-interruption-recovery',
    organizationId,
    planCode: 'creator',
    recurringOptionCode: target.option.code,
    stripePriceId: targetPrice.id,
  }, database, new Date('2026-07-17T00:00:00.000Z'))
  const scheduleId = 'sub_sched_create_interruption_recovery'
  const observations = { createCount: 0, updateCount: 0 }
  let metadata: Record<string, string> = {}
  let phases: unknown[] | null = null
  const currentPhase = {
    end_date: toUnixSeconds(local.currentPeriodEnd),
    items: [{ price: currentPrice.id, quantity: 1 }],
    metadata: {},
    start_date: toUnixSeconds(local.currentPeriodStart),
  }
  const schedule = () => ({
    current_phase: {
      end_date: toUnixSeconds(local.currentPeriodEnd),
      start_date: toUnixSeconds(local.currentPeriodStart),
    },
    customer: local.stripeCustomerId,
    id: scheduleId,
    livemode: false,
    metadata,
    phases: phases ?? [currentPhase],
    released_subscription: null,
    status: 'active',
    subscription: local.stripeSubscriptionId,
  })
  const stripe = {
    subscriptionSchedules: {
      create: async (input: { metadata?: Record<string, string> }) => {
        observations.createCount += 1
        metadata = input.metadata ?? {}
        return schedule()
      },
      retrieve: async () => schedule(),
      update: async (
        _id: string,
        input: {
          metadata?: Record<string, string>
          phases?: unknown[]
        },
      ) => {
        observations.updateCount += 1
        metadata = input.metadata ?? {}
        phases = input.phases ?? null
        return schedule()
      },
    },
  } as unknown as StripeClient
  await stripe.subscriptionSchedules.create({
    from_subscription: local.stripeSubscriptionId,
    metadata: subscriptionChangeScheduleMetadata({
      intentId: admitted.intent.id,
      organizationId,
      targetBillingInterval: 'month',
      targetCatalogRevision: target.offer.catalogRevision,
      targetOfferCode: target.offer.offerCode,
      targetPlanCode: 'creator',
      targetRecurringOptionCode: target.option.code,
    }),
  })
  const interrupted = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .select(['status', 'stripeScheduleId'])
    .where('id', '=', admitted.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    observations.createCount === 1
    && interrupted.status === 'pending'
    && interrupted.stripeScheduleId === null,
    'schedule_create_interruption_not_reproduced',
  )
  await actions.processStripeSubscriptionChangeSchedule({
    eventType: 'subscription_schedule.created',
    stripeScheduleId: scheduleId,
  }, database, stripe)
  const recovered = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .innerJoin(
      'billingSubscriptions',
      'billingSubscriptions.id',
      'billingSubscriptionChangeIntents.billingSubscriptionId',
    )
    .select([
      'billingSubscriptionChangeIntents.status',
      'billingSubscriptionChangeIntents.stripeScheduleId',
      'billingSubscriptions.scheduledPlanCode',
    ])
    .where('billingSubscriptionChangeIntents.id', '=', admitted.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    observations.createCount === 1
    && observations.updateCount === 1
    && recovered.status === 'applied'
    && recovered.stripeScheduleId === scheduleId
    && recovered.scheduledPlanCode === 'creator',
    'schedule_created_webhook_recovery_failed',
  )
}

async function verifyScheduleInterruption(
  database: Kysely<Database>,
  actions: SubscriptionChangeRecoveryActions,
) {
  const organizationId = 'billing-org-zz-subscription-change'
  const local = await database.selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow()
  const current = getBillingOffer({
    billingInterval: local.billingInterval,
    planCode: 'pro',
    recurringOptionCode: local.recurringOptionCode,
  })!
  const target = getBillingOffer({
    billingInterval: 'month',
    planCode: 'creator',
    recurringOptionCode: 'creator-1600',
  })!
  const currentPrice = stripePrice(
    'price_recovery_pro_month',
    'pro',
    local.recurringOptionCode,
    'month',
  )
  const targetPrice = stripePrice(
    'price_recovery_creator_month',
    'creator',
    'creator-1600',
    'month',
  )
  const admitted = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'renewal',
    idempotencyKey: 'schedule-interruption-recovery',
    organizationId,
    planCode: 'creator',
    recurringOptionCode: 'creator-1600',
    stripePriceId: targetPrice.id,
  }, database, new Date('2026-07-17T00:00:00.000Z'))
  invariant(admitted.leaseToken, 'schedule_recovery_lease_missing')
  const scheduleId = 'sub_sched_interruption_recovery'
  let createCount = 0
  let updateCount = 0
  let scheduleCreated = false
  let scheduleMetadata: Record<string, string> = {}
  let configuredPhases: unknown[] | null = null
  const currentPhase = {
    end_date: toUnixSeconds(local.currentPeriodEnd),
    items: [{ price: currentPrice.id, quantity: 1 }],
    metadata: {},
    start_date: toUnixSeconds(local.currentPeriodStart),
  }
  const schedule = () => ({
    current_phase: {
      end_date: toUnixSeconds(local.currentPeriodEnd),
      start_date: toUnixSeconds(local.currentPeriodStart),
    },
    customer: local.stripeCustomerId,
    id: scheduleId,
    livemode: false,
    metadata: scheduleMetadata,
    phases: configuredPhases ?? [currentPhase],
    released_subscription: null,
    status: 'active',
    subscription: local.stripeSubscriptionId,
  })
  const stripe = {
    prices: {
      list: async (input: { lookup_keys?: string[] }) => ({
        data: input.lookup_keys?.[0] === current.offer.stripeLookupKey
          ? [currentPrice]
          : input.lookup_keys?.[0] === target.offer.stripeLookupKey
            ? [targetPrice]
            : [],
      }),
    },
    subscriptionSchedules: {
      create: async (input: { metadata?: Record<string, string> }) => {
        createCount += 1
        scheduleCreated = true
        scheduleMetadata = input.metadata ?? {}
        return schedule()
      },
      retrieve: async () => schedule(),
      update: async (
        _id: string,
        input: {
          metadata?: Record<string, string>
          phases?: unknown[]
        },
      ) => {
        updateCount += 1
        scheduleMetadata = input.metadata ?? {}
        configuredPhases = input.phases ?? null
        return schedule()
      },
    },
    subscriptions: {
      retrieve: async () => ({
        customer: local.stripeCustomerId,
        id: local.stripeSubscriptionId,
        livemode: false,
        schedule: scheduleCreated ? scheduleId : null,
      }),
    },
  } as unknown as StripeClient

  let interrupted = false
  try {
    await actions.scheduleSubscriptionChangeAtRenewal({
      currentBillingInterval: local.billingInterval,
      currentCatalogRevision: current.offer.catalogRevision,
      currentOfferCode: current.offer.offerCode,
      currentPlanCode: 'pro',
      currentPriceId: currentPrice.id,
      currentRecurringOptionCode: current.option.code,
      intentId: admitted.intent.id,
      leaseToken: admitted.leaseToken,
      organizationId,
      renewalAt: local.currentPeriodEnd,
      stripeCustomerId: local.stripeCustomerId,
      stripeSubscriptionId: local.stripeSubscriptionId,
      targetBillingInterval: 'month',
      targetCatalogRevision: target.offer.catalogRevision,
      targetOfferCode: target.offer.offerCode,
      targetPlanCode: 'creator',
      targetPriceId: targetPrice.id,
      targetRecurringOptionCode: target.option.code,
    }, stripe, interruptSubscriptionProjection(database))
  }
  catch (error) {
    interrupted = error instanceof Error
      && error.message === 'simulated_projection_interruption'
  }
  const beforeRecovery = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .innerJoin(
      'billingSubscriptions',
      'billingSubscriptions.id',
      'billingSubscriptionChangeIntents.billingSubscriptionId',
    )
    .select([
      'billingSubscriptionChangeIntents.status',
      'billingSubscriptionChangeIntents.stripeScheduleId',
      'billingSubscriptions.scheduledPlanCode',
    ])
    .where('billingSubscriptionChangeIntents.id', '=', admitted.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    interrupted
    && createCount === 1
    && updateCount === 1
    && beforeRecovery.status === 'pending'
    && beforeRecovery.stripeScheduleId === scheduleId
    && beforeRecovery.scheduledPlanCode === null,
    'schedule_interruption_not_reproduced',
  )
  await actions.processStripeSubscriptionChangeSchedule({
    eventType: 'subscription_schedule.updated',
    stripeScheduleId: scheduleId,
  }, database, stripe)
  const recovered = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .innerJoin(
      'billingSubscriptions',
      'billingSubscriptions.id',
      'billingSubscriptionChangeIntents.billingSubscriptionId',
    )
    .select([
      'billingSubscriptionChangeIntents.status',
      'billingSubscriptions.scheduledPlanCode',
      'billingSubscriptions.scheduledRecurringOptionCode',
    ])
    .where('billingSubscriptionChangeIntents.id', '=', admitted.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    createCount === 1
    && recovered.status === 'applied'
    && recovered.scheduledPlanCode === 'creator'
    && recovered.scheduledRecurringOptionCode === 'creator-1600',
    'schedule_webhook_recovery_failed',
  )
}

async function verifyImmediateInvoiceInterruption(
  database: Kysely<Database>,
  actions: SubscriptionChangeRecoveryActions,
  accounting: BillingAccounting,
) {
  const organizationId = 'billing-org-zz-subscription-immediate-recovery'
  const seeded = await seedCreatorMonthlySubscription(
    organizationId,
    'immediate_recovery',
    database,
    accounting,
  )
  const prorationDate = new Date('2026-07-15T00:00:00.000Z')
  const creditAdjustment = proratedUpgradeCredits({
    currentMonthlyCredits: 1_600,
    effectiveAt: prorationDate,
    periodEnd: seeded.currentPeriodEnd,
    periodStart: seeded.currentPeriodStart,
    targetMonthlyCredits: 5_300,
  })
  const intent = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'immediate',
    creditAdjustment,
    expectedAmountDueMinor: 1_700,
    idempotencyKey: 'immediate-interruption-recovery',
    organizationId,
    planCode: 'pro',
    prorationDate,
    recurringOptionCode: 'pro-5300',
    stripePriceId: 'price_immediate_recovery_pro',
  }, database, prorationDate)
  const invoiceId = 'in_immediate_interruption_recovery'
  const invoice = {
    amount_due: 1_700,
    amount_paid: 0,
    billing_reason: 'subscription_update',
    created: toUnixSeconds(prorationDate),
    currency: 'usd',
    customer: 'cus_immediate_recovery',
    hosted_invoice_url: 'https://invoice.stripe.test/recover',
    id: invoiceId,
    livemode: false,
    parent: {
      subscription_details: {
        metadata: {
          talelabs_organization_id: organizationId,
          talelabs_subscription_change_intent_id: intent.intent.id,
        },
        subscription: seeded.stripeSubscriptionId,
      },
      type: 'subscription_details',
    },
    status: 'open',
    status_transitions: { paid_at: null },
  }
  let updateCount = 0
  const subscription = {
    customer: 'cus_immediate_recovery',
    id: seeded.stripeSubscriptionId,
    items: { data: [] },
    latest_invoice: invoice,
    livemode: false,
    metadata: {
      talelabs_organization_id: organizationId,
      talelabs_subscription_change_intent_id: intent.intent.id,
    },
    pending_update: { expires_at: toUnixSeconds(seeded.currentPeriodEnd) },
  }
  const stripe = {
    invoices: {
      retrieve: async () => invoice,
    },
    subscriptions: {
      retrieve: async () => subscription,
      update: async () => {
        updateCount += 1
        return subscription
      },
    },
  } as unknown as StripeClient

  await stripe.subscriptions.update(seeded.stripeSubscriptionId, {})
  const beforeRecovery = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .select('stripeInvoiceId')
    .where('id', '=', intent.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    updateCount === 1 && beforeRecovery.stripeInvoiceId === null,
    'immediate_update_interruption_not_reproduced',
  )
  await actions.processSubscriptionChangePaymentAction(
    invoiceId,
    database,
    stripe,
  )
  const replay = await actions.replayExistingSubscriptionChange({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    idempotencyKey: 'immediate-interruption-recovery',
    organizationId,
    planCode: 'pro',
    prorationDate,
    recurringOptionCode: 'pro-5300',
  }, database, stripe)
  const afterRecovery = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .select('stripeInvoiceId')
    .where('id', '=', intent.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    replay?.status === 'payment_required'
    && replay.paymentUrl === invoice.hosted_invoice_url
    && afterRecovery.stripeInvoiceId === invoiceId,
    'immediate_payment_url_recovery_failed',
  )
}

/** Certifies both external-success/local-interruption recovery boundaries. */
export async function verifySubscriptionChangeRecovery(
  database: Kysely<Database>,
  actions: SubscriptionChangeRecoveryActions,
  accounting: BillingAccounting,
) {
  await verifyScheduleCreateInterruption(database, actions, accounting)
  await verifyScheduleInterruption(database, actions)
  await verifyImmediateInvoiceInterruption(database, actions, accounting)
}
