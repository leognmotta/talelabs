/** Exact replay and paid-Invoice recovery for subscription change requests. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'
import type {
  ApplySubscriptionChangeInput,
} from './subscription-change.service.js'

import {
  BILLING_CATALOG,
  getBillingOffer,
} from '@talelabs/billing'
import {
  applyPaidSubscriptionChange,
  attachSubscriptionChangeExternalReference,
  failAbandonedSubscriptionChange,
} from '@talelabs/db'
import {
  resolvePaidInvoicePaymentIntentId,
  resolvePaidSubscriptionChangeFacts,
} from '@talelabs/stripe'

import { HttpError } from '../../middleware/error.js'
import { resolveStripeBillingPrice } from './stripe-resources.service.js'
import {
  admitSubscriptionChangeIntent,
} from './subscription-change-intent.service.js'
import {
  scheduleSubscriptionChangeAtRenewal,
} from './subscription-change-schedule.service.js'

interface RecoverableRenewalIntent {
  billingSubscriptionId: string
  catalogRevision: string
  changeMode: 'immediate' | 'renewal'
  creditAdjustment: number
  expectedAmountDueMinor: null | number
  expiresAt: Date
  fromBillingInterval: 'month' | 'year'
  fromOfferCode: string
  fromPlanCode: 'creator' | 'pro'
  fromRecurringOptionCode: string
  id: string
  idempotencyKey: string
  organizationId: string
  prorationDate: Date | null
  status: 'applied' | 'failed' | 'pending'
  stripeInvoiceId: null | string
  stripePriceId: null | string
  stripeRequestLeaseToken: null | string
  stripeScheduleId: null | string
  toBillingInterval: 'month' | 'year'
  toMonthlyCredits: null | number
  toOfferCode: string
  toPlanCode: 'creator' | 'pro'
  toRecurringOptionCode: string
}

function fromUnixSeconds(value: number) {
  return new Date(value * 1_000)
}

function stripeObjectId(
  value: null | string | { id: string } | undefined,
) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function assertExistingChangeTarget(
  intent: {
    catalogRevision: string
    changeMode: 'immediate' | 'renewal'
    prorationDate: Date | null
    toBillingInterval: 'month' | 'year'
    toPlanCode: 'creator' | 'pro'
    toRecurringOptionCode: string
  },
  input: ApplySubscriptionChangeInput,
) {
  if (
    intent.catalogRevision !== input.catalogRevision
    || intent.toPlanCode !== input.planCode
    || intent.toRecurringOptionCode !== input.recurringOptionCode
    || intent.toBillingInterval !== input.billingInterval
    || (intent.changeMode === 'immediate'
      && intent.prorationDate?.getTime() !== input.prorationDate?.getTime())
  ) {
    throw new HttpError(
      409,
      'idempotency_conflict',
      'Idempotency-Key was already used for another subscription change.',
    )
  }
}

async function resumeRenewalSchedule(
  intent: RecoverableRenewalIntent,
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  if (
    intent.changeMode !== 'renewal'
    || !intent.stripePriceId
  ) {
    return null
  }
  const [local, current, next] = await Promise.all([
    database.selectFrom('billingSubscriptions')
      .selectAll()
      .where('organizationId', '=', intent.organizationId)
      .where('id', '=', intent.billingSubscriptionId)
      .executeTakeFirstOrThrow(),
    Promise.resolve(getBillingOffer({
      billingInterval: intent.fromBillingInterval,
      planCode: intent.fromPlanCode,
      recurringOptionCode: intent.fromRecurringOptionCode,
    })),
    Promise.resolve(getBillingOffer({
      billingInterval: intent.toBillingInterval,
      planCode: intent.toPlanCode,
      recurringOptionCode: intent.toRecurringOptionCode,
    })),
  ])
  if (
    !current
    || !next
    || current.offer.offerCode !== intent.fromOfferCode
    || next.offer.offerCode !== intent.toOfferCode
  ) {
    throw new Error('subscription_change_catalog_facts_missing')
  }
  const admitted = intent.stripeRequestLeaseToken
    ? { intent, leaseToken: intent.stripeRequestLeaseToken, local }
    : await admitSubscriptionChangeIntent({
        billingInterval: intent.toBillingInterval,
        catalogRevision: intent.catalogRevision,
        changeMode: 'renewal',
        idempotencyKey: intent.idempotencyKey,
        organizationId: intent.organizationId,
        planCode: intent.toPlanCode,
        recurringOptionCode: intent.toRecurringOptionCode,
        stripePriceId: intent.stripePriceId,
      }, database)
  if (!admitted.leaseToken)
    throw new Error('subscription_change_intent_lease_missing')
  const [currentPrice, nextPrice] = await Promise.all([
    resolveStripeBillingPrice({
      billingInterval: intent.fromBillingInterval,
      catalogRevision: current.offer.catalogRevision,
      monthlyCredits: current.option.monthlyCredits,
      offerCode: current.offer.offerCode,
      planCode: intent.fromPlanCode,
      priceUsdCents: current.offer.priceUsdCents,
      recurringOptionCode: current.option.code,
      stripeLookupKey: current.offer.stripeLookupKey,
    }, stripe),
    resolveStripeBillingPrice({
      billingInterval: intent.toBillingInterval,
      catalogRevision: next.offer.catalogRevision,
      monthlyCredits: next.option.monthlyCredits,
      offerCode: next.offer.offerCode,
      planCode: intent.toPlanCode,
      priceUsdCents: next.offer.priceUsdCents,
      recurringOptionCode: next.option.code,
      stripeLookupKey: next.offer.stripeLookupKey,
    }, stripe),
  ])
  if (nextPrice.id !== intent.stripePriceId)
    throw new Error('subscription_change_price_mismatch')
  await scheduleSubscriptionChangeAtRenewal({
    currentBillingInterval: intent.fromBillingInterval,
    currentCatalogRevision: current.offer.catalogRevision,
    currentOfferCode: current.offer.offerCode,
    currentPlanCode: intent.fromPlanCode,
    currentPriceId: currentPrice.id,
    currentRecurringOptionCode: current.option.code,
    existingStripeScheduleId: intent.stripeScheduleId,
    intentId: intent.id,
    leaseToken: admitted.leaseToken,
    organizationId: intent.organizationId,
    renewalAt: local.currentPeriodEnd,
    stripeCustomerId: local.stripeCustomerId,
    stripeSubscriptionId: local.stripeSubscriptionId,
    targetBillingInterval: intent.toBillingInterval,
    targetCatalogRevision: next.offer.catalogRevision,
    targetOfferCode: next.offer.offerCode,
    targetPlanCode: intent.toPlanCode,
    targetPriceId: nextPrice.id,
    targetRecurringOptionCode: next.option.code,
  }, stripe, database)
  return {
    creditsAdded: 0,
    paymentUrl: null,
    status: 'scheduled' as const,
  }
}

async function retrieveSubscriptionChangeInvoice(
  intent: RecoverableRenewalIntent,
  local: {
    stripeCustomerId: string
    stripeSubscriptionId: string
  },
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  const subscription = await stripe.subscriptions.retrieve(
    local.stripeSubscriptionId,
    { expand: ['latest_invoice'] },
  )
  if (
    subscription.livemode
    || stripeObjectId(subscription.customer) !== local.stripeCustomerId
  ) {
    throw new Error('stripe_subscription_change_owner_mismatch')
  }
  let invoice: null | Stripe.Invoice = null
  if (intent.stripeInvoiceId) {
    invoice = await stripe.invoices.retrieve(intent.stripeInvoiceId, {
      expand: ['payments'],
    })
  }
  else if (subscription.latest_invoice) {
    invoice = typeof subscription.latest_invoice === 'string'
      ? await stripe.invoices.retrieve(subscription.latest_invoice, {
          expand: ['payments'],
        })
      : subscription.latest_invoice
  }
  if (!invoice) {
    if (
      subscription.pending_update
      || subscription.metadata.talelabs_subscription_change_intent_id
      === intent.id
    ) {
      throw new Error('stripe_subscription_change_invoice_missing')
    }
    return null
  }
  const parent = invoice.parent?.type === 'subscription_details'
    ? invoice.parent.subscription_details
    : null
  const belongsToIntent
    = parent?.metadata?.talelabs_subscription_change_intent_id === intent.id
      && parent.metadata.talelabs_organization_id === intent.organizationId
  if (!belongsToIntent && !intent.stripeInvoiceId) {
    if (
      subscription.pending_update
      || subscription.metadata.talelabs_subscription_change_intent_id
      === intent.id
    ) {
      throw new Error('stripe_subscription_change_invoice_mismatch')
    }
    return null
  }
  if (
    invoice.livemode
    || !belongsToIntent
    || invoice.billing_reason !== 'subscription_update'
    || invoice.currency !== BILLING_CATALOG.currency
    || invoice.amount_due !== intent.expectedAmountDueMinor
    || stripeObjectId(invoice.customer) !== local.stripeCustomerId
    || stripeObjectId(parent?.subscription) !== local.stripeSubscriptionId
  ) {
    throw new Error('stripe_subscription_change_invoice_mismatch')
  }
  await attachSubscriptionChangeExternalReference({
    changeMode: 'immediate',
    intentId: intent.id,
    organizationId: intent.organizationId,
    stripeInvoiceId: invoice.id,
  }, database)
  return { invoice, subscription }
}

async function recoverImmediateChange(
  intent: RecoverableRenewalIntent,
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  if (intent.changeMode !== 'immediate')
    return null
  const local = await database
    .selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', intent.organizationId)
    .where('id', '=', intent.billingSubscriptionId)
    .executeTakeFirstOrThrow()
  const recovered = await retrieveSubscriptionChangeInvoice(
    intent,
    local,
    database,
    stripe,
  )
  if (!recovered)
    return null
  const { invoice, subscription } = recovered
  if (invoice.status !== 'paid') {
    if (invoice.status !== 'open' || !invoice.hosted_invoice_url) {
      throw new HttpError(
        409,
        'subscription_change_not_available',
        'The subscription change payment can no longer be completed.',
      )
    }
    return {
      creditsAdded: 0,
      paymentUrl: invoice.hosted_invoice_url,
      status: 'payment_required' as const,
    }
  }
  if (
    !intent.expectedAmountDueMinor
    || !intent.stripePriceId
    || !intent.toMonthlyCredits
  ) {
    throw new Error('subscription_change_payment_facts_missing')
  }
  const facts = await resolvePaidSubscriptionChangeFacts(
    invoice,
    subscription,
    {
      billingInterval: intent.toBillingInterval,
      catalogRevision: intent.catalogRevision,
      expectedAmountDueMinor: intent.expectedAmountDueMinor,
      intentId: intent.id,
      monthlyCredits: intent.toMonthlyCredits,
      offerCode: intent.toOfferCode,
      organizationId: intent.organizationId,
      planCode: intent.toPlanCode,
      recurringOptionCode: intent.toRecurringOptionCode,
      stripePriceId: intent.stripePriceId,
      stripeSubscriptionId: local.stripeSubscriptionId,
    },
    stripe,
  )
  const applied = await applyPaidSubscriptionChange({
    ...facts,
    intentId: intent.id,
    organizationId: intent.organizationId,
    paidAt: fromUnixSeconds(
      invoice.status_transitions.paid_at ?? invoice.created,
    ),
    stripePaymentIntentId: await resolvePaidInvoicePaymentIntentId(
      invoice,
      stripe,
    ),
  }, database)
  return {
    creditsAdded: applied.replayed
      ? intent.creditAdjustment
      : applied.creditGrant,
    paymentUrl: null,
    status: 'applied' as const,
  }
}

/**
 * Replays or recovers the organization's durable change before another Stripe
 * mutation can be admitted.
 */
export async function replayExistingSubscriptionChange(
  input: ApplySubscriptionChangeInput,
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  const requestIntent = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('idempotencyKey', '=', input.idempotencyKey)
    .executeTakeFirst()
  const intent = requestIntent ?? await database
    .selectFrom('billingSubscriptionChangeIntents')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('status', '=', 'pending')
    .executeTakeFirst()
  if (!intent)
    return null
  if (requestIntent)
    assertExistingChangeTarget(intent, input)
  if (intent.status === 'applied') {
    return {
      creditsAdded:
        intent.changeMode === 'immediate' ? intent.creditAdjustment : 0,
      paymentUrl: null,
      status:
        intent.changeMode === 'immediate'
          ? 'applied' as const
          : 'scheduled' as const,
    }
  }
  if (intent.status === 'failed') {
    throw new HttpError(
      409,
      'subscription_change_not_available',
      'The previous subscription change can no longer be resumed.',
    )
  }
  const recovered = intent.changeMode === 'renewal'
    ? await resumeRenewalSchedule(intent, database, stripe)
    : await recoverImmediateChange(intent, database, stripe)
  if (recovered) {
    if (!requestIntent) {
      throw new HttpError(
        409,
        'subscription_change_in_progress',
        'Another subscription change is already in progress.',
      )
    }
    return recovered
  }
  if (!requestIntent) {
    if (intent.expiresAt <= new Date()) {
      await failAbandonedSubscriptionChange({
        intentId: intent.id,
        organizationId: intent.organizationId,
        reasonCode: 'subscription_change_intent_expired',
      }, database)
      return null
    }
    throw new HttpError(
      409,
      'subscription_change_in_progress',
      'Another subscription change is already in progress.',
    )
  }
  return null
}
