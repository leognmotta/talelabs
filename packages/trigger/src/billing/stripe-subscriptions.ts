/** Current Stripe Subscription lifecycle projection. */

import type { BillingCatalog } from '@talelabs/billing'
import type { BillingSubscriptionStatus, DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import { createId } from '@paralleldrive/cuid2'
import {
  BILLING_CATALOG,
  findBillingOfferByStripeLookupKey,
} from '@talelabs/billing'
import {
  db,
  ensureOrganizationBillingState,
  withDatabaseTransaction,
} from '@talelabs/db'
import { assertStripeTestMode, stripeClient } from '@talelabs/stripe'

import { assertStripeTestResource, stripeObjectId } from './stripe-facts.js'
import { lockOrganizationSubscriptionState } from './stripe-subscription-state.js'

function fromUnixSeconds(value: number) {
  return new Date(value * 1_000)
}

function normalizeSubscriptionStatus(
  status: Stripe.Subscription.Status,
): BillingSubscriptionStatus {
  switch (status) {
    case 'active':
    case 'canceled':
    case 'incomplete':
    case 'incomplete_expired':
    case 'past_due':
    case 'paused':
    case 'trialing':
    case 'unpaid':
      return status
    default:
      throw new Error('stripe_subscription_status_unsupported')
  }
}

async function resolveSubscriptionOrganization(
  input: {
    customerId: string
    metadataOrganizationId: string | undefined
  },
  database: DatabaseExecutor,
) {
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select('organizationId')
    .where('stripeCustomerId', '=', input.customerId)
    .executeTakeFirstOrThrow()
  if (
    !input.metadataOrganizationId
    || account.organizationId !== input.metadataOrganizationId
  ) {
    throw new Error('stripe_subscription_organization_mismatch')
  }
  return account.organizationId
}

async function releaseActivatedSubscriptionSchedule(
  input: {
    resolvedBillingInterval: 'month' | 'year'
    resolvedPlanCode: 'creator' | 'pro'
    resolvedRecurringOptionCode: string
    stripeSchedule: Stripe.Subscription['schedule']
    stripeSubscriptionId: string
  },
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  const existing = await database
    .selectFrom('billingSubscriptions')
    .select([
      'scheduledBillingInterval',
      'scheduledPlanCode',
      'scheduledRecurringOptionCode',
    ])
    .where('stripeSubscriptionId', '=', input.stripeSubscriptionId)
    .executeTakeFirst()
  const targetActivated
    = existing?.scheduledPlanCode === input.resolvedPlanCode
      && existing.scheduledRecurringOptionCode
      === input.resolvedRecurringOptionCode
      && existing.scheduledBillingInterval === input.resolvedBillingInterval
  const scheduleId = stripeObjectId(input.stripeSchedule)
  if (!targetActivated || !scheduleId)
    return
  const released = await stripe.subscriptionSchedules.release(
    scheduleId,
    { preserve_cancel_date: true },
    {
      idempotencyKey: `talelabs:subscription-schedule:${scheduleId}:release-at-target`,
    },
  )
  if (
    released.livemode
    || released.status !== 'released'
    || released.released_subscription !== input.stripeSubscriptionId
  ) {
    throw new Error('stripe_subscription_schedule_release_mismatch')
  }
}

/** Projects one current Stripe Subscription without treating it as payment. */
export async function projectStripeSubscription(
  stripeSubscriptionId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
  catalog: BillingCatalog = BILLING_CATALOG,
) {
  assertStripeTestMode()
  const subscription
    = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  assertStripeTestResource(subscription, 'subscription')
  const customerId = stripeObjectId(subscription.customer)
  const item = subscription.items.data[0]
  if (!customerId || subscription.items.data.length !== 1 || !item)
    throw new Error('stripe_subscription_shape_invalid')
  const lookupKey = item.price.lookup_key
  const resolved = lookupKey
    ? findBillingOfferByStripeLookupKey(lookupKey, catalog)
    : null
  if (
    !resolved
    || item.quantity !== 1
    || item.price.currency !== catalog.currency
    || item.price.unit_amount !== resolved.offer.priceUsdCents
    || item.price.recurring?.interval !== resolved.billingInterval
    || item.price.metadata.talelabs_catalog_revision
    !== resolved.offer.catalogRevision
    || subscription.metadata.talelabs_offer_code !== resolved.offer.offerCode
    || subscription.metadata.talelabs_plan_code !== resolved.planCode
    || subscription.metadata.talelabs_recurring_option_code
    !== resolved.recurringOptionCode
  ) {
    throw new Error('stripe_subscription_catalog_mismatch')
  }
  const organizationId = await resolveSubscriptionOrganization(
    {
      customerId,
      metadataOrganizationId: subscription.metadata.talelabs_organization_id,
    },
    database,
  )
  const status = normalizeSubscriptionStatus(subscription.status)
  const startsAt = fromUnixSeconds(item.current_period_start)
  const endsAt = fromUnixSeconds(item.current_period_end)
  // Newer Stripe Billing behavior may represent a portal cancellation with
  // `cancel_at` at the current period boundary while leaving
  // `cancel_at_period_end` false. Both forms mean the paid entitlement is
  // scheduled to end and must project as canceling in TaleLabs.
  const cancelAtPeriodEnd = Boolean(
    subscription.cancel_at_period_end || subscription.cancel_at != null,
  )
  await releaseActivatedSubscriptionSchedule(
    {
      resolvedBillingInterval: resolved.billingInterval,
      resolvedPlanCode: resolved.planCode,
      resolvedRecurringOptionCode: resolved.recurringOptionCode,
      stripeSchedule: subscription.schedule,
      stripeSubscriptionId: subscription.id,
    },
    database,
    stripe,
  )

  await withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(
      {
        catalogRevision: catalog.revision,
        organizationId,
      },
      trx,
    )
    const lockedState = await lockOrganizationSubscriptionState(
      organizationId,
      trx,
    )
    const existing = lockedState.subscriptions.find(
      candidate => candidate.stripeSubscriptionId === subscription.id,
    )
    const checkoutIntentId
      = subscription.metadata.talelabs_subscription_checkout_intent_id
    const checkoutIntent = checkoutIntentId
      ? await trx
          .selectFrom('billingSubscriptionCheckoutIntents')
          .selectAll()
          .where('organizationId', '=', organizationId)
          .where('id', '=', checkoutIntentId)
          .forUpdate()
          .executeTakeFirst()
      : null
    // Checkout delivery status is audit history: a later paid Invoice can
    // recover the same current Stripe Subscription after a failed event. Once
    // the intent is bound to this Subscription, its original offer is also
    // historical because authorized plan changes mutate the Subscription.
    const checkoutIntentBoundToSubscription
      = checkoutIntent?.stripeSubscriptionId === subscription.id
    if (
      checkoutIntentId
      && (!checkoutIntent
        || (checkoutIntent.stripeSubscriptionId !== null
          && !checkoutIntentBoundToSubscription)
        || (!checkoutIntentBoundToSubscription
          && (checkoutIntent.planCode !== resolved.planCode
            || checkoutIntent.recurringOptionCode
            !== resolved.recurringOptionCode
            || checkoutIntent.offerCode !== resolved.offer.offerCode
            || checkoutIntent.billingInterval !== resolved.billingInterval)))
    ) {
      throw new Error('stripe_subscription_checkout_intent_mismatch')
    }
    if (status !== 'canceled' && status !== 'incomplete_expired') {
      const otherCurrentSubscription = lockedState.subscriptions.find(
        candidate =>
          candidate.status !== 'canceled'
          && candidate.status !== 'incomplete_expired'
          && candidate.stripeSubscriptionId !== subscription.id,
      )
      if (otherCurrentSubscription)
        throw new Error('stripe_subscription_organization_already_active')
    }
    const activatedScheduledOption
      = existing?.scheduledPlanCode === resolved.planCode
        && existing.scheduledRecurringOptionCode === resolved.recurringOptionCode
        && existing.scheduledBillingInterval === resolved.billingInterval
    const resetCreditSchedule = Boolean(
      activatedScheduledOption
      && existing
      && existing.billingInterval !== resolved.billingInterval,
    )
    await trx
      .insertInto('billingSubscriptions')
      .values({
        billingInterval: resolved.billingInterval,
        cancelAtPeriodEnd,
        catalogRevision: resolved.offer.catalogRevision,
        currentPeriodEnd: endsAt,
        currentPeriodStart: startsAt,
        id: existing?.id ?? createId(),
        offerCode: resolved.offer.offerCode,
        organizationId,
        originalAnchorAt: startsAt,
        planCode: resolved.planCode,
        recurringOptionCode: resolved.recurringOptionCode,
        status,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
      })
      .onConflict(conflict =>
        conflict.column('stripeSubscriptionId').doUpdateSet({
          billingInterval: resolved.billingInterval,
          cancelAtPeriodEnd,
          catalogRevision: resolved.offer.catalogRevision,
          creditScheduleRevision:
            resetCreditSchedule && existing
              ? (BigInt(existing.creditScheduleRevision) + 1n).toString()
              : undefined,
          currentPeriodEnd: endsAt,
          currentPeriodStart: startsAt,
          offerCode: resolved.offer.offerCode,
          originalAnchorAt: resetCreditSchedule ? startsAt : undefined,
          planCode: resolved.planCode,
          recurringOptionCode: resolved.recurringOptionCode,
          scheduledBillingInterval: activatedScheduledOption ? null : undefined,
          scheduledOfferCode: activatedScheduledOption ? null : undefined,
          scheduledPlanCode: activatedScheduledOption ? null : undefined,
          scheduledRecurringOptionCode: activatedScheduledOption
            ? null
            : undefined,
          status,
          stripeCustomerId: customerId,
          updatedAt: new Date(),
        }),
      )
      .execute()
    if (checkoutIntent) {
      await trx
        .updateTable('billingSubscriptionCheckoutIntents')
        .set({
          completedAt: new Date(),
          status: 'completed',
          stripeRequestLeaseExpiresAt: null,
          stripeRequestLeaseToken: null,
          stripeSubscriptionId: subscription.id,
          updatedAt: new Date(),
        })
        .where('organizationId', '=', organizationId)
        .where('id', '=', checkoutIntent.id)
        .execute()
    }
    if (status === 'past_due' || status === 'unpaid') {
      await trx
        .updateTable('organizationBillingAccounts')
        .set(eb => ({
          managedExecutionReason: 'subscription_payment_past_due',
          managedExecutionStatus: 'past_due',
          revision: eb('revision', '+', '1'),
          updatedAt: new Date(),
        }))
        .where('organizationId', '=', organizationId)
        .where('managedExecutionStatus', '<>', 'blocked_review')
        .execute()
    }
    if (status === 'active' || status === 'trialing') {
      await trx
        .updateTable('organizationBillingAccounts')
        .set(eb => ({
          managedExecutionReason: null,
          managedExecutionStatus: 'active',
          revision: eb('revision', '+', '1'),
          updatedAt: new Date(),
        }))
        .where('organizationId', '=', organizationId)
        .where('managedExecutionStatus', '=', 'past_due')
        .execute()
    }
    if (status === 'canceled') {
      if (
        !lockedState.account.paidThrough
        || lockedState.account.paidThrough <= new Date()
      ) {
        await trx
          .updateTable('organizationBillingAccounts')
          .set(eb => ({
            catalogRevision: catalog.revision,
            currentOfferCode: null,
            currentPlanCode: 'free',
            currentRecurringOptionCode: null,
            managedExecutionReason: null,
            managedExecutionStatus: 'active',
            paidThrough: null,
            revision: eb('revision', '+', '1'),
            updatedAt: new Date(),
          }))
          .where('organizationId', '=', organizationId)
          .execute()
      }
    }
  })
  return { organizationId, subscription }
}
