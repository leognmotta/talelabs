/** Stripe Subscription Schedule application for renewal-boundary changes. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { StripeClient } from '@talelabs/stripe'

import {
  assertSubscriptionChangeSchedule,
  assertSubscriptionChangeScheduleOwner,
  buildSubscriptionChangeScheduleUpdate,
  subscriptionChangeScheduleMetadata,
} from '@talelabs/stripe'

import { HttpError } from '../../middleware/error.js'
import {
  attachSubscriptionChangeSchedule,
  completeSubscriptionChangeIntent,
} from './subscription-change-intent.service.js'

function toUnixSeconds(value: Date) {
  return Math.floor(value.getTime() / 1_000)
}

function stripeObjectId(value: null | string | { id: string } | undefined) {
  return typeof value === 'string' ? value : (value?.id ?? null)
}

/** Creates, verifies, and commits one next-renewal Stripe schedule. */
export async function scheduleSubscriptionChangeAtRenewal(
  input: {
    /** Current billing cadence. */
    currentBillingInterval: 'month' | 'year'
    /** Current immutable catalog revision. */
    currentCatalogRevision: string
    /** Current immutable offer. */
    currentOfferCode: string
    /** Current paid plan. */
    currentPlanCode: 'creator' | 'pro'
    /** Exact current Stripe Price. */
    currentPriceId: string
    /** Current recurring option. */
    currentRecurringOptionCode: string
    /** Durable local change identity. */
    intentId: string
    /** Schedule identity already persisted by an earlier attempt or webhook. */
    existingStripeScheduleId?: null | string
    /** Current Stripe request lease. */
    leaseToken: string
    /** Tenant owning the subscription. */
    organizationId: string
    /** Current paid-period boundary. */
    renewalAt: Date
    /** Exact Stripe Subscription. */
    stripeSubscriptionId: string
    /** Exact Stripe Customer owning the Subscription. */
    stripeCustomerId: string
    /** Target billing cadence. */
    targetBillingInterval: 'month' | 'year'
    /** Target immutable catalog revision. */
    targetCatalogRevision: string
    /** Target immutable offer. */
    targetOfferCode: string
    /** Target paid plan. */
    targetPlanCode: 'creator' | 'pro'
    /** Exact target Stripe Price. */
    targetPriceId: string
    /** Target recurring option. */
    targetRecurringOptionCode: string
  },
  stripe: StripeClient,
  database: DatabaseExecutor,
) {
  const metadata = subscriptionChangeScheduleMetadata(input)
  let scheduleId = input.existingStripeScheduleId ?? null
  if (!scheduleId) {
    const subscription = await stripe.subscriptions.retrieve(
      input.stripeSubscriptionId,
    )
    if (
      subscription.livemode
      || stripeObjectId(subscription.customer) !== input.stripeCustomerId
    ) {
      throw new HttpError(
        503,
        'stripe_subscription_mismatch',
        'The Stripe subscription does not match the local billing projection.',
      )
    }
    scheduleId = stripeObjectId(subscription.schedule)
  }
  if (!scheduleId) {
    scheduleId = (
      await stripe.subscriptionSchedules.create(
        {
          from_subscription: input.stripeSubscriptionId,
          metadata,
        },
        {
          idempotencyKey:
            `talelabs:subscription-change:${input.intentId}:schedule`,
        },
      )
    ).id
  }
  await attachSubscriptionChangeSchedule(
    {
      intentId: input.intentId,
      leaseToken: input.leaseToken,
      organizationId: input.organizationId,
      stripeScheduleId: scheduleId,
    },
    database,
  )
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
  const renewalAt = toUnixSeconds(input.renewalAt)
  try {
    assertSubscriptionChangeScheduleOwner(schedule, {
      intentId: input.intentId,
      organizationId: input.organizationId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    })
  }
  catch {
    throw new HttpError(
      503,
      'stripe_subscription_mismatch',
      'The Stripe subscription schedule does not belong to this request.',
    )
  }
  if (
    schedule.livemode
    || !schedule.current_phase
    || schedule.current_phase.end_date !== renewalAt
  ) {
    throw new HttpError(
      409,
      'subscription_projection_changed',
      'The subscription renewed while the change was being scheduled.',
    )
  }
  await stripe.subscriptionSchedules.update(
    schedule.id,
    buildSubscriptionChangeScheduleUpdate({
      ...input,
      currentPhaseStart: schedule.current_phase.start_date,
      renewalAt,
    }),
    {
      idempotencyKey: `talelabs:subscription-change:${input.intentId}:update`,
    },
  )
  const reconciled = await stripe.subscriptionSchedules.retrieve(schedule.id)
  try {
    assertSubscriptionChangeSchedule(reconciled, {
      intentId: input.intentId,
      organizationId: input.organizationId,
      renewalAt,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      targetBillingInterval: input.targetBillingInterval,
      targetCatalogRevision: input.targetCatalogRevision,
      targetOfferCode: input.targetOfferCode,
      targetPlanCode: input.targetPlanCode,
      targetPriceId: input.targetPriceId,
      targetRecurringOptionCode: input.targetRecurringOptionCode,
    })
  }
  catch {
    throw new HttpError(
      503,
      'stripe_subscription_mismatch',
      'The Stripe subscription schedule did not reconcile to the request.',
    )
  }
  await completeSubscriptionChangeIntent(
    {
      intentId: input.intentId,
      leaseToken: input.leaseToken,
      organizationId: input.organizationId,
      stripeScheduleId: reconciled.id,
    },
    database,
  )
}
