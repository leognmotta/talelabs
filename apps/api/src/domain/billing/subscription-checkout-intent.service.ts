/** Durable organization serialization for recurring Stripe Checkout creation. */

import type { DatabaseExecutor } from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'
import {
  ensureOrganizationBillingState,
  withDatabaseTransaction,
} from '@talelabs/db'

import { HttpError } from '../../middleware/error.js'

const CHECKOUT_INTENT_TTL_MS = 31 * 60 * 1_000
const STRIPE_REQUEST_LEASE_MS = 2 * 60 * 1_000

interface SubscriptionCheckoutIntentTarget {
  /** Monthly or annual customer cadence. */
  billingInterval: 'month' | 'year'
  /** Catalog revision authorizing this Checkout. */
  catalogRevision: string
  /** Immutable commercial offer. */
  offerCode: string
  /** Active authenticated tenant. */
  organizationId: string
  /** Creator or Pro target plan. */
  planCode: 'creator' | 'pro'
  /** Exact recurring allowance within the plan. */
  recurringOptionCode: string
}

function targetMatches(
  intent: SubscriptionCheckoutIntentTarget,
  target: SubscriptionCheckoutIntentTarget,
) {
  return intent.billingInterval === target.billingInterval
    && intent.catalogRevision === target.catalogRevision
    && intent.offerCode === target.offerCode
    && intent.organizationId === target.organizationId
    && intent.planCode === target.planCode
    && intent.recurringOptionCode === target.recurringOptionCode
}

/** Admits or reuses one pending Checkout intent and leases Stripe creation. */
export async function admitSubscriptionCheckoutIntent(
  input: SubscriptionCheckoutIntentTarget & {
    /** Caller-selected request identity. */
    idempotencyKey: string
  },
  database: DatabaseExecutor,
  now = new Date(),
) {
  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(input, trx)
    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()

    await trx.updateTable('billingSubscriptionCheckoutIntents')
      .set({
        status: 'expired',
        stripeRequestLeaseExpiresAt: null,
        stripeRequestLeaseToken: null,
        updatedAt: now,
      })
      .where('organizationId', '=', input.organizationId)
      .where('status', '=', 'pending')
      .where('expiresAt', '<=', now)
      .execute()

    const currentSubscription = await trx.selectFrom('billingSubscriptions')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('status', 'not in', ['canceled', 'incomplete_expired'])
      .forUpdate()
      .executeTakeFirst()
    if (currentSubscription) {
      throw new HttpError(
        409,
        'subscription_already_active',
        'The organization already has a subscription.',
      )
    }

    const requestIntent = await trx
      .selectFrom('billingSubscriptionCheckoutIntents')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey)
      .forUpdate()
      .executeTakeFirst()
    if (requestIntent && !targetMatches(requestIntent, input)) {
      throw new HttpError(
        409,
        'idempotency_conflict',
        'Idempotency-Key was already used for another subscription Checkout.',
      )
    }
    if (
      requestIntent
      && requestIntent.status !== 'pending'
    ) {
      throw new HttpError(
        409,
        'subscription_checkout_not_available',
        'The previous subscription Checkout is no longer available.',
      )
    }

    const pendingIntent = requestIntent ?? await trx
      .selectFrom('billingSubscriptionCheckoutIntents')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('status', '=', 'pending')
      .forUpdate()
      .executeTakeFirst()
    if (pendingIntent && !targetMatches(pendingIntent, input)) {
      throw new HttpError(
        409,
        'subscription_checkout_in_progress',
        'Another subscription Checkout is already in progress.',
      )
    }
    if (pendingIntent?.stripeCheckoutSessionId) {
      return {
        intent: pendingIntent,
        leaseToken: null,
        ownsStripeRequestLease: false as const,
      }
    }
    if (
      pendingIntent?.stripeRequestLeaseExpiresAt
      && pendingIntent.stripeRequestLeaseExpiresAt > now
    ) {
      throw new HttpError(
        409,
        'subscription_checkout_in_progress',
        'The subscription Checkout is being prepared.',
      )
    }

    const leaseToken = createId()
    const leaseExpiresAt = new Date(now.getTime() + STRIPE_REQUEST_LEASE_MS)
    if (pendingIntent) {
      const intent = await trx.updateTable(
        'billingSubscriptionCheckoutIntents',
      )
        .set({
          stripeRequestLeaseExpiresAt: leaseExpiresAt,
          stripeRequestLeaseToken: leaseToken,
          updatedAt: now,
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', pendingIntent.id)
        .where('status', '=', 'pending')
        .returningAll()
        .executeTakeFirstOrThrow()
      return {
        intent,
        leaseToken,
        ownsStripeRequestLease: true as const,
      }
    }

    const intent = {
      billingInterval: input.billingInterval,
      catalogRevision: input.catalogRevision,
      expiresAt: new Date(now.getTime() + CHECKOUT_INTENT_TTL_MS),
      id: createId(),
      idempotencyKey: input.idempotencyKey,
      offerCode: input.offerCode,
      organizationId: input.organizationId,
      planCode: input.planCode,
      recurringOptionCode: input.recurringOptionCode,
      status: 'pending' as const,
      stripeRequestLeaseExpiresAt: leaseExpiresAt,
      stripeRequestLeaseToken: leaseToken,
    }
    await trx.insertInto('billingSubscriptionCheckoutIntents')
      .values(intent)
      .execute()
    return {
      intent: {
        ...intent,
        completedAt: null,
        createdAt: now,
        stripeCheckoutSessionId: null,
        stripeSubscriptionId: null,
        updatedAt: now,
      },
      leaseToken,
      ownsStripeRequestLease: true as const,
    }
  })
}

/** Persists the one Stripe Session created under the current request lease. */
export async function attachSubscriptionCheckoutSession(input: {
  /** Durable local Checkout intent. */
  intentId: string
  /** Lease that performed the external Stripe request. */
  leaseToken: string
  /** Tenant owning the intent. */
  organizationId: string
  /** Stripe-hosted Session identity. */
  stripeCheckoutSessionId: string
}, database: DatabaseExecutor) {
  const updated = await database
    .updateTable('billingSubscriptionCheckoutIntents')
    .set({
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripeRequestLeaseExpiresAt: null,
      stripeRequestLeaseToken: null,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.intentId)
    .where('status', '=', 'pending')
    .where('stripeRequestLeaseToken', '=', input.leaseToken)
    .where(eb => eb.or([
      eb('stripeCheckoutSessionId', 'is', null),
      eb('stripeCheckoutSessionId', '=', input.stripeCheckoutSessionId),
    ]))
    .returning('id')
    .executeTakeFirst()
  if (updated)
    return

  const completed = await database
    .selectFrom('billingSubscriptionCheckoutIntents')
    .select([
      'status',
      'stripeCheckoutSessionId',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.intentId)
    .executeTakeFirst()
  if (
    completed?.status !== 'completed'
    || (
      completed.stripeCheckoutSessionId
      && completed.stripeCheckoutSessionId !== input.stripeCheckoutSessionId
    )
  ) {
    throw new Error('subscription_checkout_intent_lease_lost')
  }

  await database.updateTable('billingSubscriptionCheckoutIntents')
    .set({
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.intentId)
    .where('status', '=', 'completed')
    .where('stripeCheckoutSessionId', 'is', null)
    .execute()
}

/** Releases a failed Stripe request lease while retaining its stable intent. */
export async function releaseSubscriptionCheckoutIntentLease(input: {
  /** Durable local Checkout intent. */
  intentId: string
  /** Lease that attempted the external Stripe request. */
  leaseToken: string
  /** Tenant owning the intent. */
  organizationId: string
}, database: DatabaseExecutor) {
  await database.updateTable('billingSubscriptionCheckoutIntents')
    .set({
      stripeRequestLeaseExpiresAt: null,
      stripeRequestLeaseToken: null,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.intentId)
    .where('status', '=', 'pending')
    .where('stripeRequestLeaseToken', '=', input.leaseToken)
    .execute()
}
