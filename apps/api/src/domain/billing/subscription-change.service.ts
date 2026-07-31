/** Preview, payment-gated execution, and renewal scheduling for paid changes. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import {
  BILLING_CATALOG,
  classifySubscriptionChange,
  getBillingOffer,
  getBillingPlan,
  monthlyGrantPeriodAt,
  proratedUpgradeCredits,
} from '@talelabs/billing'
import {
  db,
  reconcileDueSubscriptionGrantsForSubscription,
} from '@talelabs/db'
import { stripeClient } from '@talelabs/stripe'

import { HttpError } from '../../middleware/error.js'
import { resolveStripeBillingPrice } from './stripe-resources.service.js'
import {
  applyImmediateSubscriptionChange,
} from './subscription-change-immediate.service.js'
import {
  admitSubscriptionChangeIntent,
  releaseSubscriptionChangeIntentLease,
} from './subscription-change-intent.service.js'
import { replayExistingSubscriptionChange } from './subscription-change-replay.service.js'
import { scheduleSubscriptionChangeAtRenewal } from './subscription-change-schedule.service.js'

interface SubscriptionChangeTargetInput {
  /** Target monthly or annual cadence. */
  billingInterval: 'month' | 'year'
  /** Current browser catalog revision. */
  catalogRevision: string
  /** Active authenticated tenant. */
  organizationId: string
  /** Target paid plan. */
  planCode: 'creator' | 'pro'
  /** Target recurring allowance. */
  recurringOptionCode: string
}

/** Exact paid-subscription change requested by an authenticated tenant. */
export interface ApplySubscriptionChangeInput extends SubscriptionChangeTargetInput {
  /** Required caller-selected request identity. */
  idempotencyKey: string
  /** Fixed preview instant required for an immediate change. */
  prorationDate?: Date
}

function toUnixSeconds(value: Date) {
  return Math.floor(value.getTime() / 1_000)
}

function fromUnixSeconds(value: number) {
  return new Date(value * 1_000)
}

function stripeObjectId(value: null | string | { id: string } | undefined) {
  return typeof value === 'string' ? value : (value?.id ?? null)
}

async function loadChangeContext(
  input: SubscriptionChangeTargetInput,
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  if (input.catalogRevision !== BILLING_CATALOG.revision) {
    throw new HttpError(
      409,
      'billing_catalog_mismatch',
      'The billing catalog changed. Refresh before continuing.',
    )
  }
  const local = await database
    .selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('status', 'not in', ['canceled', 'incomplete_expired'])
    .executeTakeFirst()
  if (
    !local
    || !local.paidThrough
    || local.paidThrough <= new Date()
    || local.status !== 'active'
    || (local.planCode !== 'creator' && local.planCode !== 'pro')
  ) {
    throw new HttpError(
      409,
      'subscription_change_not_available',
      'A current paid subscription in good standing is required.',
    )
  }
  if (local.cancelAtPeriodEnd) {
    throw new HttpError(
      409,
      'subscription_change_cancellation_pending',
      'Resume the subscription before changing its plan or billing cadence.',
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
  if (!current || !next) {
    throw new HttpError(
      409,
      'subscription_change_not_available',
      'The current or requested paid offer is unavailable.',
    )
  }
  const currentPlan = getBillingPlan(local.planCode)
  const nextPlan = getBillingPlan(input.planCode)
  const mode = classifySubscriptionChange(
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
  if (mode === 'current') {
    throw new HttpError(
      409,
      'subscription_change_not_available',
      'The requested paid offer is already current.',
    )
  }
  await reconcileDueSubscriptionGrantsForSubscription(
    {
      billingSubscriptionId: local.id,
      organizationId: input.organizationId,
    },
    database,
  )
  const [currentPrice, nextPrice, subscription] = await Promise.all([
    resolveStripeBillingPrice(
      {
        billingInterval: local.billingInterval,
        catalogRevision: current.offer.catalogRevision,
        monthlyCredits: current.option.monthlyCredits,
        offerCode: current.offer.offerCode,
        planCode: local.planCode,
        priceUsdCents: current.offer.priceUsdCents,
        recurringOptionCode: local.recurringOptionCode,
        stripeLookupKey: current.offer.stripeLookupKey,
      },
      stripe,
    ),
    resolveStripeBillingPrice(
      {
        billingInterval: input.billingInterval,
        catalogRevision: next.offer.catalogRevision,
        monthlyCredits: next.option.monthlyCredits,
        offerCode: next.offer.offerCode,
        planCode: input.planCode,
        priceUsdCents: next.offer.priceUsdCents,
        recurringOptionCode: input.recurringOptionCode,
        stripeLookupKey: next.offer.stripeLookupKey,
      },
      stripe,
    ),
    stripe.subscriptions.retrieve(local.stripeSubscriptionId),
  ])
  const item = subscription.items.data[0]
  if (
    subscription.livemode
    || stripeObjectId(subscription.customer) !== local.stripeCustomerId
    || subscription.items.data.length !== 1
    || !item
    || item.price.id !== currentPrice.id
    || toUnixSeconds(local.currentPeriodStart) !== item.current_period_start
    || toUnixSeconds(local.currentPeriodEnd) !== item.current_period_end
    || subscription.collection_method !== 'charge_automatically'
    || subscription.pending_update
    || subscription.schedule
  ) {
    throw new HttpError(
      503,
      'stripe_subscription_mismatch',
      'The Stripe subscription does not match the local billing projection.',
    )
  }
  return {
    current,
    currentPlan,
    currentPrice,
    item,
    local,
    mode,
    next,
    nextPlan,
    nextPrice,
    subscription,
    targetBillingInterval: input.billingInterval,
  }
}

async function creditsForImmediateChange(
  context: Awaited<ReturnType<typeof loadChangeContext>>,
  organizationId: string,
  prorationDate: Date,
  database: DatabaseExecutor,
) {
  if (
    context.local.billingInterval === 'month'
    && context.targetBillingInterval === 'year'
  ) {
    const currentPeriod = monthlyGrantPeriodAt(
      context.local.originalAnchorAt,
      prorationDate,
    )
    const period = await database
      .selectFrom('subscriptionCreditPeriods')
      .select(['carriedCredits', 'grantedCredits'])
      .where('organizationId', '=', organizationId)
      .where('billingSubscriptionId', '=', context.local.id)
      .where('scheduleRevision', '=', context.local.creditScheduleRevision)
      .where('ordinal', '=', currentPeriod.ordinal)
      .executeTakeFirstOrThrow()
    return Math.max(
      0,
      context.next.option.monthlyCredits
      - period.carriedCredits
      - period.grantedCredits,
    )
  }
  const currentPeriod = monthlyGrantPeriodAt(
    context.local.originalAnchorAt,
    prorationDate,
  )
  return proratedUpgradeCredits({
    currentMonthlyCredits: context.current.option.monthlyCredits,
    effectiveAt: prorationDate,
    periodEnd: currentPeriod.endsAt,
    periodStart: currentPeriod.startsAt,
    targetMonthlyCredits: context.next.option.monthlyCredits,
  })
}

async function buildSubscriptionChangePreview(
  input: SubscriptionChangeTargetInput & { prorationDate?: Date },
  database: DatabaseExecutor,
  stripe: StripeClient,
) {
  const context = await loadChangeContext(input, database, stripe)
  if (context.mode === 'renewal') {
    return {
      amountDueNowMinor: 0,
      billingInterval: input.billingInterval,
      creditsAddedNow: 0,
      effectiveAt: context.local.currentPeriodEnd,
      mode: 'renewal' as const,
      nextRenewalAt: context.local.currentPeriodEnd,
      planCode: input.planCode,
      prorationDate: null,
      recurringOptionCode: input.recurringOptionCode,
      storageBytes: context.nextPlan.storageBytes,
      targetMonthlyCredits: context.next.option.monthlyCredits,
      targetPriceUsdCents: context.next.offer.priceUsdCents,
    }
  }
  const nowSeconds = input.prorationDate
    ? toUnixSeconds(input.prorationDate)
    : Math.floor(Date.now() / 1_000)
  const prorationDate = fromUnixSeconds(nowSeconds)
  if (
    prorationDate < context.local.currentPeriodStart
    || prorationDate >= context.local.currentPeriodEnd
  ) {
    throw new HttpError(
      409,
      'subscription_projection_changed',
      'The subscription period changed. Refresh before continuing.',
    )
  }
  const resetsCadence = context.local.billingInterval !== input.billingInterval
  const preview = await stripe.invoices.createPreview({
    subscription: context.subscription.id,
    subscription_details: {
      ...(!resetsCadence && { billing_cycle_anchor: 'unchanged' as const }),
      items: [
        {
          id: context.item.id,
          price: context.nextPrice.id,
          quantity: 1,
        },
      ],
      proration_behavior: 'always_invoice',
      proration_date: nowSeconds,
    },
  })
  if (
    preview.livemode
    || preview.currency !== BILLING_CATALOG.currency
    || preview.amount_due <= 0
  ) {
    throw new HttpError(
      503,
      'stripe_subscription_preview_unavailable',
      'The exact subscription change total is temporarily unavailable.',
    )
  }
  const creditsAddedNow = await creditsForImmediateChange(
    context,
    input.organizationId,
    prorationDate,
    database,
  )
  return {
    amountDueNowMinor: preview.amount_due,
    billingInterval: input.billingInterval,
    creditsAddedNow,
    effectiveAt: prorationDate,
    mode: 'immediate' as const,
    nextRenewalAt: resetsCadence ? null : context.local.currentPeriodEnd,
    planCode: input.planCode,
    prorationDate,
    recurringOptionCode: input.recurringOptionCode,
    storageBytes: context.nextPlan.storageBytes,
    stripePriceId: context.nextPrice.id,
    targetMonthlyCredits: context.next.option.monthlyCredits,
    targetPriceUsdCents: context.next.offer.priceUsdCents,
  }
}

/** Returns the exact amount, credits, timing, and cadence before confirmation. */
export async function previewSubscriptionChange(
  input: SubscriptionChangeTargetInput,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  return buildSubscriptionChangePreview(input, database, stripe)
}

async function applyRenewalChange(
  admitted: Awaited<ReturnType<typeof admitSubscriptionChangeIntent>> & {
    currentPrice: Stripe.Price
    item: Stripe.SubscriptionItem
    nextPrice: Stripe.Price
  },
  stripe: StripeClient,
  database: DatabaseExecutor,
) {
  if (!admitted.leaseToken)
    return
  await scheduleSubscriptionChangeAtRenewal(
    {
      currentBillingInterval: admitted.local.billingInterval,
      currentCatalogRevision: admitted.current.offer.catalogRevision,
      currentOfferCode: admitted.current.offer.offerCode,
      currentPlanCode: admitted.intent.fromPlanCode,
      currentPriceId: admitted.currentPrice.id,
      currentRecurringOptionCode: admitted.current.option.code,
      existingStripeScheduleId: admitted.intent.stripeScheduleId,
      intentId: admitted.intent.id,
      leaseToken: admitted.leaseToken,
      organizationId: admitted.local.organizationId,
      renewalAt: admitted.local.currentPeriodEnd,
      stripeCustomerId: admitted.local.stripeCustomerId,
      stripeSubscriptionId: admitted.local.stripeSubscriptionId,
      targetBillingInterval: admitted.intent.toBillingInterval,
      targetCatalogRevision: admitted.next.offer.catalogRevision,
      targetOfferCode: admitted.next.offer.offerCode,
      targetPlanCode: admitted.intent.toPlanCode,
      targetPriceId: admitted.nextPrice.id,
      targetRecurringOptionCode: admitted.next.option.code,
    },
    stripe,
    database,
  )
}

/** Applies an immediate paid increase or schedules a renewal-boundary decrease. */
export async function updatePaidSubscription(
  input: ApplySubscriptionChangeInput,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  const replay = await replayExistingSubscriptionChange(
    input,
    database,
    stripe,
  )
  if (replay)
    return replay
  const preview = await buildSubscriptionChangePreview(
    {
      ...input,
      prorationDate: input.prorationDate,
    },
    database,
    stripe,
  )
  if (
    preview.mode === 'immediate'
    && (!input.prorationDate
      || preview.prorationDate?.getTime() !== input.prorationDate.getTime())
  ) {
    throw new HttpError(
      409,
      'subscription_change_preview_expired',
      'Review the current subscription change total before confirming.',
    )
  }
  const context = await loadChangeContext(input, database, stripe)
  const admitted = await admitSubscriptionChangeIntent(
    {
      billingInterval: input.billingInterval,
      catalogRevision: input.catalogRevision,
      changeMode: preview.mode,
      creditAdjustment:
        preview.mode === 'immediate' ? preview.creditsAddedNow : undefined,
      expectedAmountDueMinor:
        preview.mode === 'immediate' ? preview.amountDueNowMinor : undefined,
      idempotencyKey: input.idempotencyKey,
      organizationId: input.organizationId,
      planCode: input.planCode,
      prorationDate: preview.prorationDate ?? undefined,
      recurringOptionCode: input.recurringOptionCode,
      stripePriceId:
        context.nextPrice.id,
    },
    database,
  )
  const enriched = {
    ...admitted,
    currentPrice: context.currentPrice,
    item: context.item,
    nextPrice: context.nextPrice,
  }
  try {
    if (preview.mode === 'renewal') {
      await applyRenewalChange(enriched, stripe, database)
      return {
        creditsAdded: 0,
        paymentUrl: null,
        status: 'scheduled' as const,
      }
    }
    return applyImmediateSubscriptionChange(enriched, stripe, database)
  }
  catch (error) {
    if (admitted.leaseToken) {
      await releaseSubscriptionChangeIntentLease(
        {
          intentId: admitted.intent.id,
          leaseToken: admitted.leaseToken,
          organizationId: input.organizationId,
        },
        database,
      )
    }
    throw error
  }
}
