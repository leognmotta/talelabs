/** Webhook recovery for Stripe subscription-change Schedules and Invoices. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { StripeClient } from '@talelabs/stripe'

import {
  applyRenewalSubscriptionChange,
  attachSubscriptionChangeExternalReference,
  db,
} from '@talelabs/db'
import {
  assertStripeTestMode,
  assertSubscriptionChangeSchedule,
  assertSubscriptionChangeScheduleOwner,
  buildSubscriptionChangeScheduleUpdate,
  stripeClient,
  subscriptionSchedulePhasePriceId,
} from '@talelabs/stripe'

import {
  assertStripeTestResource,
  stripeObjectId,
} from './stripe-facts.js'
import { processPaidStripeInvoice } from './stripe-subscription-invoices.js'

function invoiceSubscriptionId(
  invoice: Awaited<ReturnType<StripeClient['invoices']['retrieve']>>,
) {
  return stripeObjectId(
    invoice.parent?.type === 'subscription_details'
      ? invoice.parent.subscription_details?.subscription
      : null,
  )
}

/**
 * Persists a payment-recovery Invoice as soon as Stripe reports required
 * customer action, independently from the API request that created it.
 */
export async function processSubscriptionChangePaymentAction(
  stripeInvoiceId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const invoice = await stripe.invoices.retrieve(stripeInvoiceId)
  assertStripeTestResource(invoice, 'invoice')
  const parent = invoice.parent?.type === 'subscription_details'
    ? invoice.parent.subscription_details
    : null
  const intentId
    = parent?.metadata?.talelabs_subscription_change_intent_id
  const organizationId = parent?.metadata?.talelabs_organization_id
  if (!intentId && !organizationId)
    return { ignored: true as const }
  if (!intentId || !organizationId)
    throw new Error('stripe_subscription_change_invoice_metadata_missing')
  if (invoice.status === 'paid' && invoice.amount_paid > 0)
    return processPaidStripeInvoice(stripeInvoiceId, database, stripe)
  const intent = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', intentId)
    .executeTakeFirstOrThrow()
  const [subscription, account] = await Promise.all([
    database.selectFrom('billingSubscriptions')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('id', '=', intent.billingSubscriptionId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('organizationBillingAccounts')
      .select('stripeCustomerId')
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
  ])
  if (
    intent.changeMode !== 'immediate'
    || !intent.expectedAmountDueMinor
    || invoice.status !== 'open'
    || !invoice.hosted_invoice_url
    || invoice.billing_reason !== 'subscription_update'
    || invoice.currency !== 'usd'
    || invoice.amount_due !== intent.expectedAmountDueMinor
    || stripeObjectId(invoice.customer) !== subscription.stripeCustomerId
    || account.stripeCustomerId !== subscription.stripeCustomerId
    || invoiceSubscriptionId(invoice) !== subscription.stripeSubscriptionId
  ) {
    throw new Error('stripe_subscription_change_invoice_mismatch')
  }
  await attachSubscriptionChangeExternalReference({
    changeMode: 'immediate',
    intentId,
    organizationId,
    stripeInvoiceId: invoice.id,
  }, database)
  return { organizationId }
}

/**
 * Attaches a newly-created Schedule and applies its verified future phase when
 * the corresponding update webhook arrives.
 */
export async function processStripeSubscriptionChangeSchedule(
  input: {
    /** Stripe Schedule event currently being reconciled. */
    eventType:
      | 'subscription_schedule.created'
      | 'subscription_schedule.updated'
    /** Exact Stripe Subscription Schedule identity. */
    stripeScheduleId: string
  },
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  let schedule = await stripe.subscriptionSchedules.retrieve(
    input.stripeScheduleId,
  )
  assertStripeTestResource(schedule, 'subscription_schedule')
  const intentId
    = schedule.metadata?.talelabs_subscription_change_intent_id
  const organizationId = schedule.metadata?.talelabs_organization_id
  if (!intentId && !organizationId)
    return { ignored: true as const }
  if (!intentId || !organizationId)
    throw new Error('stripe_subscription_change_schedule_metadata_missing')
  const intent = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', intentId)
    .executeTakeFirstOrThrow()
  const subscription = await database
    .selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', intent.billingSubscriptionId)
    .executeTakeFirstOrThrow()
  if (intent.changeMode !== 'renewal' || !intent.stripePriceId)
    throw new Error('stripe_subscription_change_schedule_intent_mismatch')
  assertSubscriptionChangeScheduleOwner(schedule, {
    intentId,
    organizationId,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
  })
  await attachSubscriptionChangeExternalReference({
    changeMode: 'renewal',
    intentId,
    organizationId,
    stripeScheduleId: schedule.id,
  }, database)
  const renewalAt = Math.floor(intent.currentPeriodEnd.getTime() / 1_000)
  const target = {
    intentId,
    organizationId,
    renewalAt,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    targetBillingInterval: intent.toBillingInterval,
    targetCatalogRevision: intent.catalogRevision,
    targetOfferCode: intent.toOfferCode,
    targetPlanCode: intent.toPlanCode,
    targetPriceId: intent.stripePriceId,
    targetRecurringOptionCode: intent.toRecurringOptionCode,
  } as const
  try {
    assertSubscriptionChangeSchedule(schedule, target)
  }
  catch (error) {
    if (
      input.eventType === 'subscription_schedule.created'
      && error instanceof Error
      && error.message === 'stripe_subscription_change_schedule_mismatch'
    ) {
      const alreadyHasTarget = schedule.phases.some(
        phase => phase.start_date === renewalAt,
      )
      const currentPhase = schedule.current_phase
        ? schedule.phases.find(
            phase => phase.start_date === schedule.current_phase?.start_date,
          )
        : null
      const currentPriceId = currentPhase
        ? subscriptionSchedulePhasePriceId(currentPhase)
        : null
      if (
        alreadyHasTarget
        || !currentPhase
        || !currentPriceId
        || currentPhase.items.length !== 1
        || currentPhase.items[0]?.quantity !== 1
        || schedule.current_phase?.end_date !== renewalAt
      ) {
        throw error
      }
      await stripe.subscriptionSchedules.update(
        schedule.id,
        buildSubscriptionChangeScheduleUpdate({
          ...target,
          currentBillingInterval: intent.fromBillingInterval,
          currentCatalogRevision: subscription.catalogRevision,
          currentOfferCode: intent.fromOfferCode,
          currentPhaseStart: currentPhase.start_date,
          currentPlanCode: intent.fromPlanCode,
          currentPriceId,
          currentRecurringOptionCode: intent.fromRecurringOptionCode,
        }),
        {
          idempotencyKey:
            `talelabs:subscription-change:${intent.id}:update`,
        },
      )
      schedule = await stripe.subscriptionSchedules.retrieve(schedule.id)
      assertStripeTestResource(schedule, 'subscription_schedule')
      assertSubscriptionChangeSchedule(schedule, target)
    }
    else {
      throw error
    }
  }
  await applyRenewalSubscriptionChange({
    intentId,
    organizationId,
    stripeScheduleId: schedule.id,
  }, database)
  return { organizationId, pending: false as const }
}
