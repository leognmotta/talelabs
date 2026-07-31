/**
 * Certifies immediate paid upgrades, cadence resets, credit ceilings, replay,
 * annual revenue allocation, and renewal-boundary decreases.
 */

import type { StripeClient } from '@talelabs/stripe'
import type { Kysely } from 'kysely'

import type { Database } from '../src/schema.js'

import {
  BILLING_CATALOG,
  getBillingOffer,
  proratedUpgradeCredits,
} from '@talelabs/billing'

import { invariant } from './billing-verifier-support.js'

type SubscriptionChangeActions = typeof import(
  '../../../apps/api/src/domain/billing/subscription-change-intent.service.js'
) & typeof import(
  '../../../apps/api/src/domain/billing/subscription-change-cancel.service.js'
)
type BillingAccounting = typeof import('../src/index.js')

const creator = getBillingOffer({
  billingInterval: 'month',
  planCode: 'creator',
  recurringOptionCode: 'creator-1600',
})!

/** Seeds one paid Creator subscription and its initial monthly grant. */
export async function seedCreatorMonthlySubscription(
  organizationId: string,
  suffix: string,
  database: Kysely<Database>,
  accounting: BillingAccounting,
) {
  const currentPeriodStart = new Date('2026-07-01T00:00:00.000Z')
  const currentPeriodEnd = new Date('2026-08-01T00:00:00.000Z')
  const subscriptionId = `subscription-${suffix}`
  const stripeSubscriptionId = `sub_${suffix}`
  const stripeInvoiceId = `in_${suffix}_creator`
  await database.updateTable('organizationBillingAccounts')
    .set({
      catalogRevision: BILLING_CATALOG.revision,
      currentOfferCode: creator.offer.offerCode,
      currentPlanCode: 'creator',
      currentRecurringOptionCode: creator.option.code,
      paidThrough: currentPeriodEnd,
      stripeCustomerId: `cus_${suffix}`,
    })
    .where('organizationId', '=', organizationId)
    .execute()
  await database.insertInto('billingSubscriptions')
    .values({
      billingInterval: 'month',
      catalogRevision: creator.offer.catalogRevision,
      currentPeriodEnd,
      currentPeriodStart,
      id: subscriptionId,
      offerCode: creator.offer.offerCode,
      organizationId,
      originalAnchorAt: currentPeriodStart,
      paidThrough: currentPeriodEnd,
      planCode: 'creator',
      recurringOptionCode: creator.option.code,
      status: 'active',
      stripeCustomerId: `cus_${suffix}`,
      stripeSubscriptionId,
    })
    .execute()
  await database.insertInto('billingPayments').values({
    amountPaidMinor: creator.offer.priceUsdCents,
    billingSubscriptionId: subscriptionId,
    creditPurchaseId: null,
    currency: 'usd',
    id: `payment-${suffix}-creator`,
    organizationId,
    paidAt: currentPeriodStart,
    paymentKind: 'subscription',
    servicePeriodEnd: currentPeriodEnd,
    servicePeriodStart: currentPeriodStart,
    settlementCurrency: null,
    settlementExchangeRate: null,
    settlementFeeMinor: null,
    settlementGrossMinor: null,
    settlementNetMinor: null,
    status: 'paid',
    stripeBalanceTransactionId: null,
    stripeCheckoutSessionId: null,
    stripeInvoiceId,
    stripeInvoiceLineItemId: `il_${suffix}_creator`,
    stripePaymentIntentId: `pi_${suffix}_creator`,
    stripePriceId: `price_${suffix}_creator`,
    subscriptionBillingInterval: 'month',
    subscriptionCatalogRevision: creator.offer.catalogRevision,
    subscriptionGrantFactsCapturedAt: currentPeriodStart,
    subscriptionMonthlyCredits: creator.option.monthlyCredits,
    subscriptionOfferCode: creator.offer.offerCode,
    subscriptionPlanCode: 'creator',
    subscriptionRecurringOptionCode: creator.option.code,
  }).execute()
  const creditPeriod = await accounting.ensureSubscriptionCreditPeriod({
    billingSubscriptionId: subscriptionId,
    ordinal: 0,
    organizationId,
    periodEnd: currentPeriodEnd,
    periodStart: currentPeriodStart,
    scheduleRevision: 0,
    targetCredits: creator.option.monthlyCredits,
  }, database)
  await accounting.appendCreditGrant({
    catalogRevision: creator.offer.catalogRevision,
    createdBy: null,
    grantPeriodEnd: currentPeriodEnd,
    grantPeriodStart: currentPeriodStart,
    idempotencyKey: `subscription:${stripeSubscriptionId}:grant:0`,
    offerCode: creator.offer.offerCode,
    organizationId,
    originalCredits: creator.option.monthlyCredits,
    outputPolicy: {
      outputVisibility: 'private',
      showcaseEligible: false,
    },
    planCode: 'creator',
    recognizedRevenueUsdCents: creator.offer.priceUsdCents,
    source: 'subscription',
    stripeInvoiceId,
    stripeSubscriptionId,
    subscriptionCreditPeriodId: creditPeriod.id,
  }, database)
  return {
    currentPeriodEnd,
    currentPeriodStart,
    stripeSubscriptionId,
    subscriptionId,
  }
}

async function verifyImmediateProUpgrade(
  database: Kysely<Database>,
  actions: SubscriptionChangeActions,
  accounting: BillingAccounting,
) {
  const organizationId = 'billing-org-zz-subscription-change'
  const seeded = await seedCreatorMonthlySubscription(
    organizationId,
    'creator_pro_change',
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
  const admitted = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'immediate',
    creditAdjustment,
    expectedAmountDueMinor: 1_700,
    idempotencyKey: 'creator-pro-immediate-change',
    organizationId,
    planCode: 'pro',
    prorationDate,
    recurringOptionCode: 'pro-5300',
    stripePriceId: 'price_pro_5300_month',
  }, database, prorationDate)
  invariant(admitted.leaseToken, 'creator_pro_change_lease')
  const paymentFacts = {
    amountPaidMinor: 1_700,
    intentId: admitted.intent.id,
    organizationId,
    paidAt: prorationDate,
    servicePeriodEnd: seeded.currentPeriodEnd,
    servicePeriodStart: prorationDate,
    stripeInvoiceId: 'in_creator_pro_change',
    stripeInvoiceLineItemId: 'il_creator_pro_change',
    stripePaymentIntentId: 'pi_creator_pro_change',
    targetPeriodEnd: seeded.currentPeriodEnd,
    targetPeriodStart: seeded.currentPeriodStart,
  }
  const applied = await accounting.applyPaidSubscriptionChange(
    paymentFacts,
    database,
  )
  const replay = await accounting.applyPaidSubscriptionChange(
    paymentFacts,
    database,
  )
  invariant(
    applied.creditGrant === creditAdjustment
    && !applied.replayed
    && replay.replayed
    && replay.creditGrant === 0,
    'creator_pro_immediate_replay',
  )
  const [subscription, period, balance, adjustmentGrants] = await Promise.all([
    database.selectFrom('billingSubscriptions')
      .select([
        'billingInterval',
        'planCode',
        'recurringOptionCode',
        'scheduledPlanCode',
      ])
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('subscriptionCreditPeriods')
      .select(['carriedCredits', 'grantedCredits', 'targetCredits'])
      .where('organizationId', '=', organizationId)
      .where('scheduleRevision', '=', '0')
      .where('ordinal', '=', 0)
      .executeTakeFirstOrThrow(),
    database.selectFrom('creditBalances')
      .select('availableCredits')
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('creditGrants')
      .select('originalCredits')
      .where('organizationId', '=', organizationId)
      .where('billingSubscriptionChangeIntentId', '=', admitted.intent.id)
      .execute(),
  ])
  invariant(
    subscription.planCode === 'pro'
    && subscription.recurringOptionCode === 'pro-5300'
    && subscription.billingInterval === 'month'
    && subscription.scheduledPlanCode === null
    && period.carriedCredits === 0
    && period.grantedCredits === 1_600 + creditAdjustment
    && period.targetCredits === 1_600 + creditAdjustment
    && balance.availableCredits === 1_600 + creditAdjustment
    && adjustmentGrants.length === 1
    && adjustmentGrants[0]?.originalCredits === creditAdjustment,
    'creator_pro_immediate_credit_ceiling',
  )

  const downgrade = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'renewal',
    idempotencyKey: 'pro-creator-renewal-change',
    organizationId,
    planCode: 'creator',
    recurringOptionCode: 'creator-1600',
    stripePriceId: 'price_creator_1600_month',
  }, database, new Date('2026-07-16T00:00:00.000Z'))
  invariant(downgrade.leaseToken, 'pro_creator_change_lease')
  await actions.completeSubscriptionChangeIntent({
    intentId: downgrade.intent.id,
    leaseToken: downgrade.leaseToken,
    organizationId,
    stripeScheduleId: 'sub_sched_pro_creator_change',
  }, database)
  const scheduled = await database.selectFrom('billingSubscriptions')
    .select([
      'scheduledBillingInterval',
      'scheduledPlanCode',
      'scheduledRecurringOptionCode',
    ])
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    scheduled.scheduledBillingInterval === 'month'
    && scheduled.scheduledPlanCode === 'creator'
    && scheduled.scheduledRecurringOptionCode === 'creator-1600',
    'pro_creator_renewal_tuple',
  )
  let scheduleReleased = false
  let releaseCount = 0
  const stripe = {
    subscriptionSchedules: {
      release: async () => {
        scheduleReleased = true
        releaseCount += 1
        return {
          id: 'sub_sched_pro_creator_change',
          livemode: false,
          released_subscription: seeded.stripeSubscriptionId,
          status: 'released',
          subscription: null,
        }
      },
      retrieve: async () => ({
        id: 'sub_sched_pro_creator_change',
        livemode: false,
        released_subscription: scheduleReleased
          ? seeded.stripeSubscriptionId
          : null,
        status: scheduleReleased ? 'released' : 'active',
        subscription: scheduleReleased
          ? null
          : seeded.stripeSubscriptionId,
      }),
    },
  } as unknown as StripeClient
  const canceled = await actions.cancelScheduledSubscriptionChange(
    organizationId,
    database,
    stripe,
  )
  const replayed = await actions.cancelScheduledSubscriptionChange(
    organizationId,
    database,
    stripe,
  )
  const afterCancellation = await database
    .selectFrom('billingSubscriptions')
    .select([
      'scheduledBillingInterval',
      'scheduledOfferCode',
      'scheduledPlanCode',
      'scheduledRecurringOptionCode',
    ])
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    canceled.canceled
    && !replayed.canceled
    && releaseCount === 1
    && afterCancellation.scheduledBillingInterval === null
    && afterCancellation.scheduledOfferCode === null
    && afterCancellation.scheduledPlanCode === null
    && afterCancellation.scheduledRecurringOptionCode === null,
    'scheduled_subscription_change_cancellation_replay',
  )
}

async function verifyImmediateAnnualSwitch(
  database: Kysely<Database>,
  actions: SubscriptionChangeActions,
  accounting: BillingAccounting,
) {
  const organizationId = 'billing-org-zz-subscription-annual-change'
  const seeded = await seedCreatorMonthlySubscription(
    organizationId,
    'creator_annual_change',
    database,
    accounting,
  )
  const prorationDate = new Date('2026-07-15T00:00:00.000Z')
  const annualPeriodEnd = new Date('2027-07-15T00:00:00.000Z')
  const admitted = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'year',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'immediate',
    creditAdjustment: 0,
    expectedAmountDueMinor: 17_400,
    idempotencyKey: 'creator-annual-immediate-change',
    organizationId,
    planCode: 'creator',
    prorationDate,
    recurringOptionCode: 'creator-1600',
    stripePriceId: 'price_creator_1600_year',
  }, database, prorationDate)
  const paymentFacts = {
    amountPaidMinor: 17_400,
    intentId: admitted.intent.id,
    organizationId,
    paidAt: prorationDate,
    servicePeriodEnd: annualPeriodEnd,
    servicePeriodStart: prorationDate,
    stripeInvoiceId: 'in_creator_annual_change',
    stripeInvoiceLineItemId: 'il_creator_annual_change',
    stripePaymentIntentId: 'pi_creator_annual_change',
    targetPeriodEnd: annualPeriodEnd,
    targetPeriodStart: prorationDate,
  }
  await accounting.applyPaidSubscriptionChange(paymentFacts, database)
  await accounting.applyPaidSubscriptionChange(paymentFacts, database)
  const current = await database.selectFrom('subscriptionCreditPeriods')
    .select([
      'carriedCredits',
      'grantedCredits',
      'scheduleRevision',
      'targetCredits',
    ])
    .where('organizationId', '=', organizationId)
    .where('ordinal', '=', 0)
    .orderBy('scheduleRevision', 'desc')
    .executeTakeFirstOrThrow()
  const balanceBeforeFutureGrants = await database.selectFrom('creditBalances')
    .select('availableCredits')
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    current.scheduleRevision === '1'
    && current.carriedCredits === 1_600
    && current.grantedCredits === 0
    && current.targetCredits === 1_600
    && balanceBeforeFutureGrants.availableCredits === 1_600,
    'annual_switch_duplicated_current_credits',
  )
  await accounting.reconcileDueSubscriptionGrantsForSubscription({
    billingSubscriptionId: seeded.subscriptionId,
    organizationId,
  }, database, new Date('2027-07-14T23:59:59.000Z'))
  const [annualGrants, finalBalance, periods] = await Promise.all([
    database.selectFrom('creditGrants')
      .select(['originalCredits', 'recognizedRevenueUsdCents'])
      .where('organizationId', '=', organizationId)
      .where('stripeInvoiceId', '=', paymentFacts.stripeInvoiceId)
      .execute(),
    database.selectFrom('creditBalances')
      .select('availableCredits')
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('subscriptionCreditPeriods')
      .select(['carriedCredits', 'grantedCredits', 'targetCredits'])
      .where('organizationId', '=', organizationId)
      .where('scheduleRevision', '=', '1')
      .execute(),
  ])
  invariant(
    annualGrants.length === 11
    && annualGrants.every(grant => grant.originalCredits === 1_600)
    && annualGrants.reduce(
      (total, grant) => total + (grant.recognizedRevenueUsdCents ?? 0),
      0,
    ) === paymentFacts.amountPaidMinor
    && finalBalance.availableCredits === 19_200
    && periods.length === 12
    && periods.every(
      period =>
        period.carriedCredits + period.grantedCredits
        <= period.targetCredits,
    ),
    'annual_switch_future_grant_allocation',
  )
}

/** Certifies paid increases now and decreases only at renewal. */
export async function verifyPaidSubscriptionChanges(
  database: Kysely<Database>,
  actions: SubscriptionChangeActions,
  accounting: BillingAccounting,
) {
  await verifyImmediateProUpgrade(database, actions, accounting)
  await verifyImmediateAnnualSwitch(database, actions, accounting)
}
