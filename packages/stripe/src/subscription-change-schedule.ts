/** Stripe Schedule ownership and target validation for subscription changes. */

import type { Stripe } from './client.js'

function objectId(
  value: null | string | { id: string } | undefined,
) {
  return typeof value === 'string' ? value : value?.id ?? null
}

/** Returns the exact Price identity carried by one Schedule phase item. */
export function subscriptionSchedulePhasePriceId(
  phase: Stripe.SubscriptionSchedule.Phase,
) {
  const price = phase.items[0]?.price
  return typeof price === 'string' ? price : price?.id ?? null
}

/** Immutable local facts embedded into and verified from a Stripe Schedule. */
export interface SubscriptionChangeScheduleTarget {
  /** Durable subscription-change intent. */
  intentId: string
  /** Tenant owning the Schedule. */
  organizationId: string
  /** Exact current paid-period boundary. */
  renewalAt: number
  /** Exact Stripe Customer. */
  stripeCustomerId: string
  /** Exact Stripe Subscription managed by the Schedule. */
  stripeSubscriptionId: string
  /** Target monthly or annual cadence. */
  targetBillingInterval: 'month' | 'year'
  /** Target code-owned catalog revision. */
  targetCatalogRevision: string
  /** Target immutable offer. */
  targetOfferCode: string
  /** Target Creator or Pro plan. */
  targetPlanCode: 'creator' | 'pro'
  /** Exact target Stripe Price. */
  targetPriceId: string
  /** Target recurring allowance option. */
  targetRecurringOptionCode: string
}

/** Complete facts required to configure current and target Schedule phases. */
export interface SubscriptionChangeScheduleConfiguration
  extends SubscriptionChangeScheduleTarget {
  /** Current monthly or annual cadence. */
  currentBillingInterval: 'month' | 'year'
  /** Current code-owned catalog revision. */
  currentCatalogRevision: string
  /** Current immutable offer. */
  currentOfferCode: string
  /** Current paid plan. */
  currentPlanCode: 'creator' | 'pro'
  /** Exact current Stripe Price. */
  currentPriceId: string
  /** Current recurring allowance option. */
  currentRecurringOptionCode: string
  /** Exact current phase start. */
  currentPhaseStart: number
}

/** Metadata that durably correlates a Schedule with its local intent. */
export function subscriptionChangeScheduleMetadata(
  target: Pick<
    SubscriptionChangeScheduleTarget,
    | 'intentId'
    | 'organizationId'
    | 'targetBillingInterval'
    | 'targetCatalogRevision'
    | 'targetOfferCode'
    | 'targetPlanCode'
    | 'targetRecurringOptionCode'
  >,
) {
  return {
    talelabs_billing_interval: target.targetBillingInterval,
    talelabs_catalog_revision: target.targetCatalogRevision,
    talelabs_offer_code: target.targetOfferCode,
    talelabs_organization_id: target.organizationId,
    talelabs_plan_code: target.targetPlanCode,
    talelabs_recurring_option_code: target.targetRecurringOptionCode,
    talelabs_subscription_change_intent_id: target.intentId,
  }
}

/** Builds the one canonical no-proration renewal Schedule update. */
export function buildSubscriptionChangeScheduleUpdate(
  input: SubscriptionChangeScheduleConfiguration,
): Stripe.SubscriptionScheduleUpdateParams {
  return {
    end_behavior: 'release',
    metadata: subscriptionChangeScheduleMetadata(input),
    phases: [
      {
        end_date: input.renewalAt,
        items: [{ price: input.currentPriceId, quantity: 1 }],
        metadata: {
          talelabs_catalog_revision: input.currentCatalogRevision,
          talelabs_offer_code: input.currentOfferCode,
          talelabs_organization_id: input.organizationId,
          talelabs_plan_code: input.currentPlanCode,
          talelabs_recurring_option_code: input.currentRecurringOptionCode,
          talelabs_subscription_checkout_intent_id: '',
        },
        proration_behavior: 'none',
        start_date: input.currentPhaseStart,
      },
      {
        duration: {
          interval: input.targetBillingInterval,
          interval_count: 1,
        },
        items: [{ price: input.targetPriceId, quantity: 1 }],
        metadata: {
          talelabs_catalog_revision: input.targetCatalogRevision,
          talelabs_offer_code: input.targetOfferCode,
          talelabs_organization_id: input.organizationId,
          talelabs_plan_code: input.targetPlanCode,
          talelabs_recurring_option_code: input.targetRecurringOptionCode,
          talelabs_subscription_checkout_intent_id: '',
          talelabs_subscription_change_intent_id: input.intentId,
        },
        proration_behavior: 'none',
        start_date: input.renewalAt,
      },
    ],
    proration_behavior: 'none',
  }
}

/** Returns the Subscription retained by an active or released Schedule. */
export function subscriptionScheduleSubscriptionId(
  schedule: Stripe.SubscriptionSchedule,
) {
  return objectId(schedule.subscription)
    ?? objectId(schedule.released_subscription)
}

/** Verifies that a Schedule belongs to the exact TaleLabs intent and tenant. */
export function assertSubscriptionChangeScheduleOwner(
  schedule: Stripe.SubscriptionSchedule,
  target: Pick<
    SubscriptionChangeScheduleTarget,
    | 'intentId'
    | 'organizationId'
    | 'stripeCustomerId'
    | 'stripeSubscriptionId'
  >,
) {
  if (
    schedule.livemode
    || objectId(schedule.customer) !== target.stripeCustomerId
    || subscriptionScheduleSubscriptionId(schedule)
    !== target.stripeSubscriptionId
    || schedule.metadata?.talelabs_organization_id !== target.organizationId
    || schedule.metadata?.talelabs_subscription_change_intent_id
    !== target.intentId
  ) {
    throw new Error('stripe_subscription_change_schedule_owner_mismatch')
  }
}

/** Verifies the complete future phase before it may be projected locally. */
export function assertSubscriptionChangeSchedule(
  schedule: Stripe.SubscriptionSchedule,
  target: SubscriptionChangeScheduleTarget,
) {
  assertSubscriptionChangeScheduleOwner(schedule, target)
  const metadata = schedule.metadata
  const nextPhase = schedule.phases.find(
    phase => phase.start_date === target.renewalAt,
  )
  if (
    schedule.status !== 'active'
    || schedule.current_phase?.end_date !== target.renewalAt
    || !nextPhase
    || subscriptionSchedulePhasePriceId(nextPhase) !== target.targetPriceId
    || nextPhase.items.length !== 1
    || nextPhase.items[0]?.quantity !== 1
    || nextPhase.metadata?.talelabs_catalog_revision
    !== target.targetCatalogRevision
    || nextPhase.metadata?.talelabs_offer_code !== target.targetOfferCode
    || nextPhase.metadata?.talelabs_organization_id !== target.organizationId
    || nextPhase.metadata?.talelabs_plan_code !== target.targetPlanCode
    || nextPhase.metadata?.talelabs_recurring_option_code
    !== target.targetRecurringOptionCode
    || nextPhase.metadata?.talelabs_subscription_change_intent_id
    !== target.intentId
    || metadata?.talelabs_catalog_revision
    !== target.targetCatalogRevision
    || metadata?.talelabs_offer_code !== target.targetOfferCode
    || metadata?.talelabs_plan_code !== target.targetPlanCode
    || metadata?.talelabs_recurring_option_code
    !== target.targetRecurringOptionCode
    || metadata?.talelabs_billing_interval
    !== target.targetBillingInterval
  ) {
    throw new Error('stripe_subscription_change_schedule_mismatch')
  }
}
