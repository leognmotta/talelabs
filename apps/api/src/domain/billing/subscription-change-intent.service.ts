/** Durable revision and lease boundary for every paid subscription change. */

import type {
  BillingSubscriptionChangeMode,
  DatabaseExecutor,
} from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'
import {
  BILLING_CATALOG,
  classifySubscriptionChange,
  getBillingOffer,
} from '@talelabs/billing'
import {
  applyRenewalSubscriptionChange,
  attachSubscriptionChangeExternalReference,
  withDatabaseTransaction,
} from '@talelabs/db'

import { HttpError } from '../../middleware/error.js'

const IMMEDIATE_INTENT_TTL_MS = 24 * 60 * 60 * 1_000
const RENEWAL_INTENT_TTL_MS = 15 * 60 * 1_000
const STRIPE_REQUEST_LEASE_MS = 2 * 60 * 1_000

/** Complete target and preview facts admitted into one durable mutation. */
export interface AdmitSubscriptionChangeInput {
  /** Target monthly or annual cadence. */
  billingInterval: 'month' | 'year'
  /** Current browser catalog revision. */
  catalogRevision: string
  /** Immediate or renewal-boundary execution selected by policy. */
  changeMode: BillingSubscriptionChangeMode
  /** Immediate credits shown by the exact preview. */
  creditAdjustment?: number
  /** Previewed immediate Stripe amount in USD cents. */
  expectedAmountDueMinor?: number
  /** Caller-selected request identity. */
  idempotencyKey: string
  /** Active authenticated tenant. */
  organizationId: string
  /** Target paid plan. */
  planCode: 'creator' | 'pro'
  /** Fixed preview proration instant for an immediate change. */
  prorationDate?: Date
  /** Requested recurring allowance. */
  recurringOptionCode: string
  /** Exact immutable target Stripe Price used by the Stripe mutation. */
  stripePriceId: string
}

function assertChangeTarget(
  intent: {
    catalogRevision: string
    changeMode: BillingSubscriptionChangeMode
    expectedAmountDueMinor: number | null
    prorationDate: Date | null
    stripePriceId: string | null
    toBillingInterval: 'month' | 'year'
    toPlanCode: 'creator' | 'pro'
    toRecurringOptionCode: string
  },
  input: AdmitSubscriptionChangeInput,
) {
  if (
    intent.catalogRevision !== input.catalogRevision
    || intent.changeMode !== input.changeMode
    || intent.toPlanCode !== input.planCode
    || intent.toRecurringOptionCode !== input.recurringOptionCode
    || intent.toBillingInterval !== input.billingInterval
    || intent.expectedAmountDueMinor
    !== (input.expectedAmountDueMinor ?? null)
    || intent.prorationDate?.getTime()
    !== input.prorationDate?.getTime()
    || intent.stripePriceId !== (input.stripePriceId ?? null)
  ) {
    throw new HttpError(
      409,
      'idempotency_conflict',
      'Idempotency-Key was already used for another subscription change.',
    )
  }
}

function validateChangeFacts(input: AdmitSubscriptionChangeInput) {
  const complete = input.prorationDate
    && Number.isSafeInteger(input.creditAdjustment)
    && (input.creditAdjustment ?? -1) >= 0
    && Number.isSafeInteger(input.expectedAmountDueMinor)
    && (input.expectedAmountDueMinor ?? 0) > 0
    && input.stripePriceId
  if (input.changeMode === 'immediate' && !complete)
    throw new Error('subscription_change_preview_facts_missing')
  if (
    input.changeMode === 'renewal'
    && (
      input.prorationDate
      || input.creditAdjustment !== undefined
      || input.expectedAmountDueMinor !== undefined
      || !input.stripePriceId
    )
  ) {
    throw new Error('subscription_change_renewal_facts_invalid')
  }
}

/** Admits or resumes one organization-serialized subscription change revision. */
export async function admitSubscriptionChangeIntent(
  input: AdmitSubscriptionChangeInput,
  database: DatabaseExecutor,
  now = new Date(),
) {
  validateChangeFacts(input)
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
    const local = subscriptions.find(
      subscription =>
        subscription.status !== 'canceled'
        && subscription.status !== 'incomplete_expired',
    )
    if (
      !local
      || !local.paidThrough
      || local.paidThrough <= now
      || local.status !== 'active'
      || (local.planCode !== 'creator' && local.planCode !== 'pro')
    ) {
      throw new HttpError(
        409,
        'subscription_change_not_available',
        'A current paid Creator or Pro subscription is required.',
      )
    }
    if (
      local.scheduledPlanCode
      || local.scheduledRecurringOptionCode
      || local.scheduledOfferCode
      || local.scheduledBillingInterval
    ) {
      throw new HttpError(
        409,
        'subscription_change_in_progress',
        'A subscription change is already scheduled.',
      )
    }
    const current = getBillingOffer({
      billingInterval: local.billingInterval,
      planCode: local.planCode,
      recurringOptionCode: local.recurringOptionCode,
    })
    const next = getBillingOffer({
      billingInterval: input.billingInterval,
      planCode: input.planCode,
      recurringOptionCode: input.recurringOptionCode,
    })
    if (!next || !current) {
      throw new HttpError(
        409,
        'subscription_change_not_available',
        'The current or requested paid offer is unavailable.',
      )
    }
    const policyMode = classifySubscriptionChange(
      {
        billingInterval: local.billingInterval,
        monthlyCredits: current.option.monthlyCredits,
        planCode: local.planCode,
        recurringOptionCode: local.recurringOptionCode,
      },
      {
        billingInterval: input.billingInterval,
        monthlyCredits: next.option.monthlyCredits,
        planCode: input.planCode,
        recurringOptionCode: input.recurringOptionCode,
      },
    )
    if (policyMode === 'current' || policyMode !== input.changeMode) {
      throw new HttpError(
        409,
        'subscription_change_not_available',
        'The requested subscription change is not available in this mode.',
      )
    }

    const requestIntent = await trx
      .selectFrom('billingSubscriptionChangeIntents')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey)
      .forUpdate()
      .executeTakeFirst()
    if (requestIntent)
      assertChangeTarget(requestIntent, input)
    if (requestIntent?.status === 'applied') {
      return {
        current,
        intent: requestIntent,
        leaseToken: null,
        local,
        next,
      }
    }
    if (requestIntent?.status === 'failed') {
      throw new HttpError(
        409,
        'subscription_change_not_available',
        'The previous subscription change can no longer be resumed.',
      )
    }

    const pendingIntent = requestIntent ?? await trx
      .selectFrom('billingSubscriptionChangeIntents')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('status', '=', 'pending')
      .forUpdate()
      .executeTakeFirst()
    if (pendingIntent && pendingIntent.id !== requestIntent?.id) {
      throw new HttpError(
        409,
        'subscription_change_in_progress',
        'Another subscription change is already in progress.',
      )
    }
    if (
      pendingIntent?.stripeRequestLeaseExpiresAt
      && pendingIntent.stripeRequestLeaseExpiresAt > now
    ) {
      throw new HttpError(
        409,
        'subscription_change_in_progress',
        'The subscription change is already being applied.',
      )
    }

    const leaseToken = createId()
    const leaseExpiresAt = new Date(now.getTime() + STRIPE_REQUEST_LEASE_MS)
    if (pendingIntent) {
      const intent = await trx.updateTable(
        'billingSubscriptionChangeIntents',
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
      return { current, intent, leaseToken, local, next }
    }

    const revision = BigInt(local.changeRevision) + 1n
    const intent = await trx.insertInto('billingSubscriptionChangeIntents')
      .values({
        billingSubscriptionId: local.id,
        catalogRevision: BILLING_CATALOG.revision,
        changeMode: input.changeMode,
        creditAdjustment: input.creditAdjustment ?? 0,
        currentPeriodEnd: local.currentPeriodEnd,
        currentPeriodStart: local.currentPeriodStart,
        expectedAmountDueMinor: input.expectedAmountDueMinor ?? null,
        expiresAt: new Date(
          now.getTime()
          + (input.changeMode === 'immediate'
            ? IMMEDIATE_INTENT_TTL_MS
            : RENEWAL_INTENT_TTL_MS),
        ),
        fromBillingInterval: local.billingInterval,
        fromMonthlyCredits: current.option.monthlyCredits,
        fromOfferCode: local.offerCode,
        fromPlanCode: local.planCode,
        fromRecurringOptionCode: local.recurringOptionCode,
        id: createId(),
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        prorationDate: input.prorationDate ?? null,
        revision,
        status: 'pending',
        stripePriceId: input.stripePriceId,
        stripeRequestLeaseExpiresAt: leaseExpiresAt,
        stripeRequestLeaseToken: leaseToken,
        toBillingInterval: input.billingInterval,
        toMonthlyCredits: next.option.monthlyCredits,
        toOfferCode: next.offer.offerCode,
        toPlanCode: input.planCode,
        toRecurringOptionCode: input.recurringOptionCode,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    await trx.updateTable('billingSubscriptions')
      .set({
        changeRevision: revision,
        updatedAt: now,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', local.id)
      .execute()
    return {
      current,
      intent,
      leaseToken,
      local: { ...local, changeRevision: revision.toString() },
      next,
    }
  })
}

/** Records the Stripe schedule discovered or created by one leased mutation. */
export async function attachSubscriptionChangeSchedule(input: {
  /** Durable local change intent. */
  intentId: string
  /** Lease that performed the Stripe operation. */
  leaseToken: string
  /** Tenant owning the intent. */
  organizationId: string
  /** Current Stripe Subscription Schedule identity. */
  stripeScheduleId: string
}, database: DatabaseExecutor) {
  await attachSubscriptionChangeExternalReference({
    changeMode: 'renewal',
    intentId: input.intentId,
    leaseToken: input.leaseToken,
    organizationId: input.organizationId,
    stripeScheduleId: input.stripeScheduleId,
  }, database)
}

/** Records the Invoice created by one payment-gated immediate mutation. */
export async function attachSubscriptionChangeInvoice(input: {
  /** Durable local change intent. */
  intentId: string
  /** Lease that performed the Stripe mutation. */
  leaseToken: string
  /** Tenant owning the intent. */
  organizationId: string
  /** Stripe Invoice created by the immediate change. */
  stripeInvoiceId: string
}, database: DatabaseExecutor) {
  await attachSubscriptionChangeExternalReference({
    changeMode: 'immediate',
    intentId: input.intentId,
    leaseToken: input.leaseToken,
    organizationId: input.organizationId,
    stripeInvoiceId: input.stripeInvoiceId,
  }, database)
}

/** Commits one renewal-boundary schedule for the still-current revision. */
export async function completeSubscriptionChangeIntent(input: {
  /** Durable local change intent. */
  intentId: string
  /** Lease that performed and reconciled the Stripe mutation. */
  leaseToken: string
  /** Tenant owning the subscription. */
  organizationId: string
  /** Reconciled Stripe Subscription Schedule identity. */
  stripeScheduleId: string
}, database: DatabaseExecutor) {
  try {
    return await applyRenewalSubscriptionChange({
      intentId: input.intentId,
      leaseToken: input.leaseToken,
      organizationId: input.organizationId,
      stripeScheduleId: input.stripeScheduleId,
    }, database)
  }
  catch (error) {
    if (
      error instanceof Error
      && error.message === 'subscription_change_projection_changed'
    ) {
      throw new HttpError(
        409,
        'subscription_projection_changed',
        'The subscription changed while the update was being persisted.',
      )
    }
    throw error
  }
}

/** Releases a retryable external-request lease without losing the revision. */
export async function releaseSubscriptionChangeIntentLease(input: {
  /** Durable local change intent. */
  intentId: string
  /** Lease that attempted the external Stripe request. */
  leaseToken: string
  /** Tenant owning the intent. */
  organizationId: string
}, database: DatabaseExecutor) {
  await database.updateTable('billingSubscriptionChangeIntents')
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
