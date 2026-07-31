/** Cancellation of one Stripe-backed renewal subscription change. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import {
  db,
  withDatabaseTransaction,
} from '@talelabs/db'
import {
  assertStripeTestMode,
  stripeClient,
} from '@talelabs/stripe'

import { HttpError } from '../../middleware/error.js'

function stripeObjectId(
  value: null | string | { id: string } | undefined,
) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function scheduleSubscriptionId(schedule: Stripe.SubscriptionSchedule) {
  return stripeObjectId(schedule.subscription)
    ?? stripeObjectId(schedule.released_subscription)
}

/**
 * Releases the active Stripe Schedule and clears its exact local projection.
 *
 * Replays after Stripe release are safe: an already-cleared local tuple is a
 * successful no-op, while any different scheduled tuple fails closed.
 */
export async function cancelScheduledSubscriptionChange(
  organizationId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const local = await database
    .selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('status', 'not in', ['canceled', 'incomplete_expired'])
    .executeTakeFirst()
  if (
    !local?.scheduledPlanCode
    || !local.scheduledRecurringOptionCode
    || !local.scheduledOfferCode
    || !local.scheduledBillingInterval
  ) {
    return { canceled: false }
  }
  if (
    local.scheduledPlanCode !== 'creator'
    && local.scheduledPlanCode !== 'pro'
  ) {
    throw new HttpError(
      409,
      'subscription_projection_changed',
      'The scheduled subscription plan is invalid.',
    )
  }
  const intent = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('billingSubscriptionId', '=', local.id)
    .where('changeMode', '=', 'renewal')
    .where('status', '=', 'applied')
    .where('toPlanCode', '=', local.scheduledPlanCode)
    .where('toRecurringOptionCode', '=', local.scheduledRecurringOptionCode)
    .where('toOfferCode', '=', local.scheduledOfferCode)
    .where('toBillingInterval', '=', local.scheduledBillingInterval)
    .orderBy('completedAt', 'desc')
    .executeTakeFirst()
  if (!intent?.stripeScheduleId) {
    throw new HttpError(
      409,
      'subscription_projection_changed',
      'The scheduled subscription change could not be reconciled.',
    )
  }
  const schedule = await stripe.subscriptionSchedules.retrieve(
    intent.stripeScheduleId,
  )
  if (
    schedule.livemode
    || scheduleSubscriptionId(schedule) !== local.stripeSubscriptionId
  ) {
    throw new HttpError(
      503,
      'stripe_subscription_mismatch',
      'The Stripe subscription schedule does not match the local projection.',
    )
  }
  const released = schedule.status === 'released'
    ? schedule
    : await stripe.subscriptionSchedules.release(
        schedule.id,
        { preserve_cancel_date: true },
        {
          idempotencyKey:
            `talelabs:subscription-change:${intent.id}:cancel-schedule`,
        },
      )
  if (
    released.livemode
    || released.status !== 'released'
    || scheduleSubscriptionId(released) !== local.stripeSubscriptionId
  ) {
    throw new HttpError(
      503,
      'stripe_subscription_mismatch',
      'The Stripe subscription schedule was not released.',
    )
  }
  const canceled = await withDatabaseTransaction(database, async (trx) => {
    await trx
      .selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const subscriptions = await trx
      .selectFrom('billingSubscriptions')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .orderBy('id')
      .forUpdate()
      .execute()
    const locked = subscriptions.find(subscription => subscription.id === local.id)
    if (
      locked
      && !locked.scheduledPlanCode
      && !locked.scheduledRecurringOptionCode
      && !locked.scheduledOfferCode
      && !locked.scheduledBillingInterval
    ) {
      return false
    }
    if (
      !locked
      || locked.scheduledPlanCode !== intent.toPlanCode
      || locked.scheduledRecurringOptionCode
      !== intent.toRecurringOptionCode
      || locked.scheduledOfferCode !== intent.toOfferCode
      || locked.scheduledBillingInterval !== intent.toBillingInterval
    ) {
      throw new HttpError(
        409,
        'subscription_projection_changed',
        'The scheduled subscription change changed during cancellation.',
      )
    }
    await trx
      .updateTable('billingSubscriptions')
      .set({
        scheduledBillingInterval: null,
        scheduledOfferCode: null,
        scheduledPlanCode: null,
        scheduledRecurringOptionCode: null,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', organizationId)
      .where('id', '=', locked.id)
      .execute()
    return true
  })
  return { canceled }
}
