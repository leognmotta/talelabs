/** Certifies webhook-first completion against the originating API lease. */

import type { Kysely } from 'kysely'

import type { Database } from '../src/schema.js'

import {
  BILLING_CATALOG,
  proratedUpgradeCredits,
} from '@talelabs/billing'

import {
  seedCreatorMonthlySubscription,
} from './billing-subscription-change-verifier.js'
import { invariant } from './billing-verifier-support.js'

type BillingAccounting = typeof import('../src/index.js')
type SubscriptionChangeActions = typeof import(
  '../../../apps/api/src/domain/billing/subscription-change-intent.service.js'
)

async function rejectsExternalReference(operation: () => Promise<unknown>) {
  try {
    await operation()
    return false
  }
  catch (error) {
    return error instanceof Error
      && error.message === 'subscription_change_external_reference_mismatch'
  }
}

/**
 * Proves that an API request can resume successfully after a fast signed
 * webhook has already applied the same immutable Invoice or Schedule.
 */
export async function verifySubscriptionChangeWebhookRace(
  database: Kysely<Database>,
  actions: SubscriptionChangeActions,
  accounting: BillingAccounting,
) {
  const organizationId = 'billing-org-zz-subscription-webhook-race'
  const seeded = await seedCreatorMonthlySubscription(
    organizationId,
    'subscription_webhook_race',
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
  const immediate = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'immediate',
    creditAdjustment,
    expectedAmountDueMinor: 1_700,
    idempotencyKey: 'immediate-webhook-wins-before-api-attach',
    organizationId,
    planCode: 'pro',
    prorationDate,
    recurringOptionCode: 'pro-5300',
    stripePriceId: 'price_webhook_race_pro_5300',
  }, database, prorationDate)
  invariant(immediate.leaseToken, 'webhook_race_immediate_lease_missing')
  const paymentFacts = {
    amountPaidMinor: 1_700,
    intentId: immediate.intent.id,
    organizationId,
    paidAt: prorationDate,
    servicePeriodEnd: seeded.currentPeriodEnd,
    servicePeriodStart: prorationDate,
    stripeInvoiceId: 'in_webhook_race_immediate',
    stripeInvoiceLineItemId: 'il_webhook_race_immediate',
    stripePaymentIntentId: 'pi_webhook_race_immediate',
    targetPeriodEnd: seeded.currentPeriodEnd,
    targetPeriodStart: seeded.currentPeriodStart,
  }

  const webhookImmediate = await accounting.applyPaidSubscriptionChange(
    paymentFacts,
    database,
  )
  await actions.attachSubscriptionChangeInvoice({
    intentId: immediate.intent.id,
    leaseToken: immediate.leaseToken,
    organizationId,
    stripeInvoiceId: paymentFacts.stripeInvoiceId,
  }, database)
  const wrongInvoiceRejected = await rejectsExternalReference(() =>
    actions.attachSubscriptionChangeInvoice({
      intentId: immediate.intent.id,
      leaseToken: immediate.leaseToken,
      organizationId,
      stripeInvoiceId: 'in_webhook_race_wrong',
    }, database),
  )
  const resumedImmediate = await accounting.applyPaidSubscriptionChange(
    paymentFacts,
    database,
  )
  const immediateProjection = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .select([
      'status',
      'stripeInvoiceId',
      'stripeRequestLeaseToken',
    ])
    .where('id', '=', immediate.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    !webhookImmediate.replayed
    && webhookImmediate.creditGrant === creditAdjustment
    && resumedImmediate.replayed
    && immediateProjection.status === 'applied'
    && immediateProjection.stripeInvoiceId === paymentFacts.stripeInvoiceId
    && immediateProjection.stripeRequestLeaseToken === null
    && wrongInvoiceRejected,
    'immediate_webhook_first_api_resume_failed',
  )

  const renewal = await actions.admitSubscriptionChangeIntent({
    billingInterval: 'month',
    catalogRevision: BILLING_CATALOG.revision,
    changeMode: 'renewal',
    idempotencyKey: 'renewal-webhook-wins-before-api-attach',
    organizationId,
    planCode: 'creator',
    recurringOptionCode: 'creator-1600',
    stripePriceId: 'price_webhook_race_creator_1600',
  }, database, new Date('2026-07-16T00:00:00.000Z'))
  invariant(renewal.leaseToken, 'webhook_race_renewal_lease_missing')
  const stripeScheduleId = 'sub_sched_webhook_race_renewal'
  await accounting.attachSubscriptionChangeExternalReference({
    changeMode: 'renewal',
    intentId: renewal.intent.id,
    organizationId,
    stripeScheduleId,
  }, database)
  const webhookRenewal = await accounting.applyRenewalSubscriptionChange({
    intentId: renewal.intent.id,
    organizationId,
    stripeScheduleId,
  }, database)
  await actions.attachSubscriptionChangeSchedule({
    intentId: renewal.intent.id,
    leaseToken: renewal.leaseToken,
    organizationId,
    stripeScheduleId,
  }, database)
  const wrongScheduleRejected = await rejectsExternalReference(() =>
    actions.attachSubscriptionChangeSchedule({
      intentId: renewal.intent.id,
      leaseToken: renewal.leaseToken,
      organizationId,
      stripeScheduleId: 'sub_sched_webhook_race_wrong',
    }, database),
  )
  const resumedRenewal = await actions.completeSubscriptionChangeIntent({
    intentId: renewal.intent.id,
    leaseToken: renewal.leaseToken,
    organizationId,
    stripeScheduleId,
  }, database)
  const renewalProjection = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .innerJoin(
      'billingSubscriptions',
      'billingSubscriptions.id',
      'billingSubscriptionChangeIntents.billingSubscriptionId',
    )
    .select([
      'billingSubscriptionChangeIntents.status',
      'billingSubscriptionChangeIntents.stripeRequestLeaseToken',
      'billingSubscriptionChangeIntents.stripeScheduleId',
      'billingSubscriptions.scheduledPlanCode',
    ])
    .where('billingSubscriptionChangeIntents.id', '=', renewal.intent.id)
    .executeTakeFirstOrThrow()
  invariant(
    !webhookRenewal.replayed
    && resumedRenewal.replayed
    && renewalProjection.status === 'applied'
    && renewalProjection.stripeScheduleId === stripeScheduleId
    && renewalProjection.stripeRequestLeaseToken === null
    && renewalProjection.scheduledPlanCode === 'creator'
    && wrongScheduleRejected,
    'renewal_webhook_first_api_resume_failed',
  )
}
