/** Idempotent local application of one Stripe-paid subscription change. */

import type { DatabaseExecutor } from './index.js'

import { createId } from '@paralleldrive/cuid2'
import {
  annualRevenueForGrantPeriod,
  monthlyGrantBoundary,
  monthlyGrantPeriodAt,
} from '@talelabs/billing'

import {
  appendCreditGrant,
  withDatabaseTransaction,
} from './index.js'

/** Stripe-proven facts required to apply an immediate paid change locally. */
export interface ApplyPaidSubscriptionChangeInput {
  /** Exact amount collected in USD cents. */
  amountPaidMinor: number
  /** Local durable change intent. */
  intentId: string
  /** Tenant owning the subscription and payment. */
  organizationId: string
  /** Confirmed Stripe payment instant. */
  paidAt: Date
  /** Inclusive target-price service boundary. */
  servicePeriodStart: Date
  /** Exclusive target-price service boundary. */
  servicePeriodEnd: Date
  /** Paid Stripe Invoice. */
  stripeInvoiceId: string
  /** Exact positive target-price Invoice Line. */
  stripeInvoiceLineItemId: string
  /** Stripe PaymentIntent used by the Invoice when available. */
  stripePaymentIntentId?: null | string
  /** Current Stripe item period start after the paid change. */
  targetPeriodStart: Date
  /** Current Stripe item period end after the paid change. */
  targetPeriodEnd: Date
}

/**
 * Applies immutable payment facts, the subscription projection, and any current
 * period credit increment in one organization-serialized transaction.
 */
export async function applyPaidSubscriptionChange(
  input: ApplyPaidSubscriptionChangeInput,
  database: DatabaseExecutor,
) {
  return withDatabaseTransaction(database, async (trx) => {
    const account = await trx.selectFrom('organizationBillingAccounts')
      .selectAll()
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
      if (intent.stripeInvoiceId !== input.stripeInvoiceId)
        throw new Error('subscription_change_payment_replay_mismatch')
      return { creditGrant: 0, replayed: true as const }
    }
    const subscription = subscriptions.find(
      candidate => candidate.id === intent.billingSubscriptionId,
    )
    if (
      !subscription
      || intent.status !== 'pending'
      || intent.changeMode !== 'immediate'
      || !intent.prorationDate
      || !intent.fromMonthlyCredits
      || !intent.toMonthlyCredits
      || !intent.expectedAmountDueMinor
      || !intent.stripePriceId
      || input.amountPaidMinor !== intent.expectedAmountDueMinor
      || input.servicePeriodEnd <= input.servicePeriodStart
      || input.targetPeriodEnd <= input.targetPeriodStart
      || BigInt(subscription.changeRevision) !== BigInt(intent.revision)
    ) {
      throw new Error('subscription_change_payment_facts_mismatch')
    }

    const existingPayment = await trx.selectFrom('billingPayments')
      .selectAll()
      .where('stripeInvoiceId', '=', input.stripeInvoiceId)
      .forUpdate()
      .executeTakeFirst()
    if (
      existingPayment
      && (
        existingPayment.organizationId !== input.organizationId
        || existingPayment.billingSubscriptionId !== subscription.id
        || existingPayment.amountPaidMinor !== input.amountPaidMinor
        || existingPayment.stripeInvoiceLineItemId
        !== input.stripeInvoiceLineItemId
        || existingPayment.stripePriceId !== intent.stripePriceId
        || existingPayment.subscriptionPlanCode !== intent.toPlanCode
        || existingPayment.subscriptionRecurringOptionCode
        !== intent.toRecurringOptionCode
        || existingPayment.subscriptionOfferCode !== intent.toOfferCode
        || existingPayment.subscriptionMonthlyCredits
        !== intent.toMonthlyCredits
        || existingPayment.subscriptionBillingInterval
        !== intent.toBillingInterval
      )
    ) {
      throw new Error('subscription_change_payment_replay_mismatch')
    }
    if (!existingPayment) {
      await trx.insertInto('billingPayments').values({
        amountPaidMinor: input.amountPaidMinor,
        billingSubscriptionId: subscription.id,
        creditPurchaseId: null,
        currency: 'usd',
        id: createId(),
        organizationId: input.organizationId,
        paidAt: input.paidAt,
        paymentKind: 'subscription',
        servicePeriodEnd: input.servicePeriodEnd,
        servicePeriodStart: input.servicePeriodStart,
        settlementCurrency: null,
        settlementExchangeRate: null,
        settlementFeeMinor: null,
        settlementGrossMinor: null,
        settlementNetMinor: null,
        status: 'paid',
        stripeBalanceTransactionId: null,
        stripeCheckoutSessionId: null,
        stripeInvoiceId: input.stripeInvoiceId,
        stripeInvoiceLineItemId: input.stripeInvoiceLineItemId,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        stripePriceId: intent.stripePriceId,
        subscriptionBillingInterval: intent.toBillingInterval,
        subscriptionCatalogRevision: intent.catalogRevision,
        subscriptionGrantFactsCapturedAt: new Date(),
        subscriptionMonthlyCredits: intent.toMonthlyCredits,
        subscriptionOfferCode: intent.toOfferCode,
        subscriptionPlanCode: intent.toPlanCode,
        subscriptionRecurringOptionCode: intent.toRecurringOptionCode,
      }).execute()
    }

    let creditPeriodId: string
    let creditScheduleRevision = subscription.creditScheduleRevision
    let originalAnchorAt = subscription.originalAnchorAt
    if (intent.fromBillingInterval === intent.toBillingInterval) {
      const currentPeriod = monthlyGrantPeriodAt(
        subscription.originalAnchorAt,
        intent.prorationDate,
      )
      const creditPeriod = await trx
        .selectFrom('subscriptionCreditPeriods')
        .selectAll()
        .where('organizationId', '=', input.organizationId)
        .where('billingSubscriptionId', '=', subscription.id)
        .where(
          'scheduleRevision',
          '=',
          subscription.creditScheduleRevision,
        )
        .where('ordinal', '=', currentPeriod.ordinal)
        .forUpdate()
        .executeTakeFirstOrThrow()
      if (
        creditPeriod.periodStart.getTime() !== currentPeriod.startsAt.getTime()
        || creditPeriod.periodEnd.getTime() !== currentPeriod.endsAt.getTime()
        || creditPeriod.carriedCredits + creditPeriod.grantedCredits < 1
      ) {
        throw new Error('subscription_change_credit_period_missing')
      }
      await trx.updateTable('subscriptionCreditPeriods')
        .set({
          targetCredits:
            creditPeriod.targetCredits + intent.creditAdjustment,
          updatedAt: new Date(),
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', creditPeriod.id)
        .execute()
      creditPeriodId = creditPeriod.id
    }
    else {
      if (
        intent.fromBillingInterval !== 'month'
        || intent.toBillingInterval !== 'year'
      ) {
        throw new Error('subscription_change_cadence_reset_invalid')
      }
      const oldSchedulePeriod = monthlyGrantPeriodAt(
        subscription.originalAnchorAt,
        intent.prorationDate,
      )
      const oldPeriod = await trx
        .selectFrom('subscriptionCreditPeriods')
        .selectAll()
        .where('organizationId', '=', input.organizationId)
        .where('billingSubscriptionId', '=', subscription.id)
        .where(
          'scheduleRevision',
          '=',
          subscription.creditScheduleRevision,
        )
        .where('ordinal', '=', oldSchedulePeriod.ordinal)
        .forUpdate()
        .executeTakeFirstOrThrow()
      const carriedCredits = Math.min(
        intent.toMonthlyCredits,
        oldPeriod.carriedCredits + oldPeriod.grantedCredits,
      )
      if (
        intent.creditAdjustment
        !== intent.toMonthlyCredits - carriedCredits
      ) {
        throw new Error('subscription_change_credit_adjustment_mismatch')
      }
      creditScheduleRevision
        = (BigInt(subscription.creditScheduleRevision) + 1n).toString()
      originalAnchorAt = input.targetPeriodStart
      const firstPeriodEnd = monthlyGrantBoundary(originalAnchorAt, 1)
      creditPeriodId = createId()
      await trx.insertInto('subscriptionCreditPeriods').values({
        billingSubscriptionId: subscription.id,
        carriedCredits,
        grantedCredits: 0,
        id: creditPeriodId,
        ordinal: 0,
        organizationId: input.organizationId,
        periodEnd: firstPeriodEnd,
        periodStart: originalAnchorAt,
        scheduleRevision: creditScheduleRevision,
        targetCredits: intent.toMonthlyCredits,
      }).execute()
    }

    let creditGrant = 0
    if (intent.creditAdjustment > 0) {
      const grantPeriod = await trx.selectFrom('subscriptionCreditPeriods')
        .selectAll()
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', creditPeriodId)
        .executeTakeFirstOrThrow()
      const grant = await appendCreditGrant({
        billingSubscriptionChangeIntentId: intent.id,
        catalogRevision: intent.catalogRevision,
        createdBy: null,
        grantPeriodEnd: grantPeriod.periodEnd,
        grantPeriodStart: grantPeriod.periodStart,
        idempotencyKey: `subscription-change:${intent.id}:grant`,
        offerCode: intent.toOfferCode,
        organizationId: input.organizationId,
        originalCredits: intent.creditAdjustment,
        outputPolicy: {
          outputVisibility: 'private',
          showcaseEligible: false,
        },
        planCode: intent.toPlanCode,
        recognizedRevenueUsdCents:
          intent.toBillingInterval === 'month'
            ? input.amountPaidMinor
            : annualRevenueForGrantPeriod({
                amountUsdCents: input.amountPaidMinor,
                anchor:
                  intent.fromBillingInterval === intent.toBillingInterval
                    ? subscription.originalAnchorAt
                    : input.targetPeriodStart,
                firstPeriodCredits: intent.creditAdjustment,
                laterPeriodCredits:
                  intent.fromBillingInterval === 'month'
                    ? intent.toMonthlyCredits
                    : intent.toMonthlyCredits - intent.fromMonthlyCredits,
                periodStart: grantPeriod.periodStart,
                servicePeriodEnd: input.servicePeriodEnd,
                servicePeriodStart: input.servicePeriodStart,
              }),
        source: 'subscription',
        stripeInvoiceId: input.stripeInvoiceId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        subscriptionCreditPeriodId: creditPeriodId,
      }, trx)
      if (!grant.replayed)
        creditGrant = intent.creditAdjustment
    }

    const paidThrough
      = subscription.paidThrough
        && subscription.paidThrough > input.targetPeriodEnd
        ? subscription.paidThrough
        : input.targetPeriodEnd
    await trx.updateTable('billingSubscriptions').set({
      billingInterval: intent.toBillingInterval,
      catalogRevision: intent.catalogRevision,
      creditScheduleRevision,
      currentPeriodEnd: input.targetPeriodEnd,
      currentPeriodStart: input.targetPeriodStart,
      offerCode: intent.toOfferCode,
      originalAnchorAt,
      paidThrough,
      planCode: intent.toPlanCode,
      recurringOptionCode: intent.toRecurringOptionCode,
      scheduledOfferCode: null,
      scheduledPlanCode: null,
      scheduledRecurringOptionCode: null,
      updatedAt: new Date(),
    }).where('organizationId', '=', input.organizationId).where('id', '=', subscription.id).execute()
    await trx.updateTable('organizationBillingAccounts').set(eb => ({
      catalogRevision: intent.catalogRevision,
      currentOfferCode: intent.toOfferCode,
      currentPlanCode: intent.toPlanCode,
      currentRecurringOptionCode: intent.toRecurringOptionCode,
      managedExecutionReason:
        account.managedExecutionStatus === 'blocked_review'
          ? eb.ref('managedExecutionReason')
          : null,
      managedExecutionStatus:
        account.managedExecutionStatus === 'blocked_review'
          ? eb.ref('managedExecutionStatus')
          : 'active',
      paidThrough,
      revision: eb('revision', '+', '1'),
      updatedAt: new Date(),
    })).where('organizationId', '=', input.organizationId).execute()
    await trx.updateTable('billingSubscriptionChangeIntents').set({
      completedAt: new Date(),
      lastErrorCode: null,
      status: 'applied',
      stripeInvoiceId: input.stripeInvoiceId,
      stripeRequestLeaseExpiresAt: null,
      stripeRequestLeaseToken: null,
      updatedAt: new Date(),
    }).where('organizationId', '=', input.organizationId).where('id', '=', intent.id).execute()
    return { creditGrant, replayed: false as const }
  })
}
