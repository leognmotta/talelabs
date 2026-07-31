/** Durable local recovery transitions for Stripe-backed subscription changes. */

import type { DatabaseExecutor } from './index.js'

import { withDatabaseTransaction } from './index.js'

type SubscriptionChangeExternalReference
  = | {
    changeMode: 'immediate'
    stripeInvoiceId: string
  }
  | {
    changeMode: 'renewal'
    stripeScheduleId: string
  }

interface SubscriptionChangeIntentIdentity {
  /** Durable subscription-change intent. */
  intentId: string
  /** Optional active API lease that must still own the mutation. */
  leaseToken?: string
  /** Tenant owning the intent and subscription. */
  organizationId: string
}

/**
 * Attaches one Stripe Schedule or Invoice identity without depending on the
 * API process that originally performed the external mutation.
 */
export async function attachSubscriptionChangeExternalReference(
  input: SubscriptionChangeIntentIdentity
    & SubscriptionChangeExternalReference,
  database: DatabaseExecutor,
) {
  return withDatabaseTransaction(database, async (trx) => {
    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const subscriptions = await trx.selectFrom('billingSubscriptions')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .orderBy('id')
      .forUpdate()
      .execute()
    const intent = await trx.selectFrom('billingSubscriptionChangeIntents')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.intentId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const subscription = subscriptions.find(
      candidate => candidate.id === intent.billingSubscriptionId,
    )
    const externalId = input.changeMode === 'renewal'
      ? input.stripeScheduleId
      : input.stripeInvoiceId
    const existingId = input.changeMode === 'renewal'
      ? intent.stripeScheduleId
      : intent.stripeInvoiceId
    if (
      !subscription
      || intent.status === 'failed'
      || intent.changeMode !== input.changeMode
      || (existingId !== null && existingId !== externalId)
    ) {
      throw new Error('subscription_change_external_reference_mismatch')
    }
    // A signed webhook may finish the exact mutation before the API process
    // resumes from Stripe. The terminal transition clears the API lease, but
    // the matching immutable external identity still proves a safe replay.
    if (existingId === externalId)
      return { replayed: true as const }
    if (
      intent.status !== 'pending'
      || (input.leaseToken !== undefined
        && intent.stripeRequestLeaseToken !== input.leaseToken)
    ) {
      throw new Error('subscription_change_external_reference_mismatch')
    }
    await trx.updateTable('billingSubscriptionChangeIntents')
      .set(input.changeMode === 'renewal'
        ? {
            stripeScheduleId: input.stripeScheduleId,
            updatedAt: new Date(),
          }
        : {
            stripeInvoiceId: input.stripeInvoiceId,
            updatedAt: new Date(),
          })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', intent.id)
      .execute()
    return { replayed: false as const }
  })
}

/**
 * Projects a verified renewal Schedule onto the exact still-current local
 * subscription revision. Webhook and API replays share this transition.
 */
export async function applyRenewalSubscriptionChange(
  input: SubscriptionChangeIntentIdentity & {
    /** Verified Stripe Subscription Schedule. */
    stripeScheduleId: string
  },
  database: DatabaseExecutor,
) {
  return withDatabaseTransaction(database, async (trx) => {
    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const subscriptions = await trx.selectFrom('billingSubscriptions')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .orderBy('id')
      .forUpdate()
      .execute()
    const intent = await trx.selectFrom('billingSubscriptionChangeIntents')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.intentId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (intent.status === 'applied') {
      if (intent.stripeScheduleId !== input.stripeScheduleId)
        throw new Error('subscription_change_schedule_replay_mismatch')
      return { replayed: true as const }
    }
    const subscription = subscriptions.find(
      candidate => candidate.id === intent.billingSubscriptionId,
    )
    if (
      !subscription
      || intent.changeMode !== 'renewal'
      || intent.status !== 'pending'
      || (input.leaseToken !== undefined
        && intent.stripeRequestLeaseToken !== input.leaseToken)
      || (intent.stripeScheduleId !== null
        && intent.stripeScheduleId !== input.stripeScheduleId)
      || BigInt(subscription.changeRevision) !== BigInt(intent.revision)
      || subscription.planCode !== intent.fromPlanCode
      || subscription.recurringOptionCode !== intent.fromRecurringOptionCode
      || subscription.offerCode !== intent.fromOfferCode
      || subscription.billingInterval !== intent.fromBillingInterval
      || subscription.currentPeriodStart.getTime()
      !== intent.currentPeriodStart.getTime()
      || subscription.currentPeriodEnd.getTime()
      !== intent.currentPeriodEnd.getTime()
    ) {
      throw new Error('subscription_change_projection_changed')
    }
    const completedAt = new Date()
    await trx.updateTable('billingSubscriptions')
      .set({
        scheduledBillingInterval: intent.toBillingInterval,
        scheduledOfferCode: intent.toOfferCode,
        scheduledPlanCode: intent.toPlanCode,
        scheduledRecurringOptionCode: intent.toRecurringOptionCode,
        updatedAt: completedAt,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', subscription.id)
      .execute()
    await trx.updateTable('billingSubscriptionChangeIntents')
      .set({
        completedAt,
        lastErrorCode: null,
        status: 'applied',
        stripeRequestLeaseExpiresAt: null,
        stripeRequestLeaseToken: null,
        stripeScheduleId: input.stripeScheduleId,
        updatedAt: completedAt,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', intent.id)
      .execute()
    return { replayed: false as const }
  })
}

/**
 * Fails an expired pending intent only after its caller has reconciled Stripe
 * and proved that no external Schedule or Invoice exists.
 */
export async function failAbandonedSubscriptionChange(
  input: SubscriptionChangeIntentIdentity & {
    /** Stable recovery failure classification. */
    reasonCode: string
  },
  database: DatabaseExecutor,
  now = new Date(),
) {
  if (!/^[a-z][a-z0-9_]{0,127}$/.test(input.reasonCode))
    throw new RangeError('A subscription-change failure code is invalid.')
  return withDatabaseTransaction(database, async (trx) => {
    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    await trx.selectFrom('billingSubscriptions')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .orderBy('id')
      .forUpdate()
      .execute()
    const intent = await trx.selectFrom('billingSubscriptionChangeIntents')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.intentId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (intent.status !== 'pending')
      return { failed: false as const }
    if (
      intent.expiresAt > now
      || intent.stripeScheduleId
      || intent.stripeInvoiceId
    ) {
      throw new Error('subscription_change_external_state_unreconciled')
    }
    await trx.updateTable('billingSubscriptionChangeIntents')
      .set({
        completedAt: now,
        lastErrorCode: input.reasonCode,
        status: 'failed',
        stripeRequestLeaseExpiresAt: null,
        stripeRequestLeaseToken: null,
        updatedAt: now,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', intent.id)
      .execute()
    return { failed: true as const }
  })
}
