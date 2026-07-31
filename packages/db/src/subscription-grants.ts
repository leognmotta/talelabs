/** Bounded lazy subscription grants and explicit Founder assignment. */

import type { DatabaseExecutor } from './index.js'

import {
  annualRevenueForGrantPeriod,
  BILLING_CATALOG,
  dueMonthlyGrantPeriods,
} from '@talelabs/billing'
import {
  appendCreditGrant,
  ensureOrganizationBillingState,
  ensureSubscriptionCreditPeriod,
  withDatabaseTransaction,
} from './index.js'

const MAX_LAZY_GRANT_PERIODS = 24

async function reconcileSubscriptionGrantPeriods(
  input: {
    billingSubscriptionId: string
    organizationId: string
  },
  database: DatabaseExecutor,
  now: Date,
) {
  const subscription = await database
    .selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.billingSubscriptionId)
    .executeTakeFirstOrThrow()
  if (!subscription?.paidThrough)
    return { grantedCredits: 0, grantCount: 0 }
  const existing = await database
    .selectFrom('subscriptionCreditPeriods')
    .select(eb => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('billingSubscriptionId', '=', subscription.id)
    .where('scheduleRevision', '=', subscription.creditScheduleRevision)
    .executeTakeFirstOrThrow()
  const periods = dueMonthlyGrantPeriods({
    anchor: subscription.originalAnchorAt,
    limit: MAX_LAZY_GRANT_PERIODS,
    now,
    paidThrough: subscription.paidThrough,
    startOrdinal: Number(existing.count),
  })
  if (!periods.length)
    return { grantedCredits: 0, grantCount: 0 }
  const payments = await database
    .selectFrom('billingPayments')
    .select([
      'amountPaidMinor',
      'servicePeriodEnd',
      'servicePeriodStart',
      'stripeInvoiceId',
      'stripeInvoiceLineItemId',
      'stripePriceId',
      'subscriptionBillingInterval',
      'subscriptionCatalogRevision',
      'subscriptionGrantFactsCapturedAt',
      'subscriptionMonthlyCredits',
      'subscriptionOfferCode',
      'subscriptionPlanCode',
      'subscriptionRecurringOptionCode',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('billingSubscriptionId', '=', subscription.id)
    .where('paymentKind', '=', 'subscription')
    .where('status', '=', 'paid')
    .orderBy('servicePeriodStart', 'desc')
    .execute()
  const changeIntents = await database
    .selectFrom('billingSubscriptionChangeIntents')
    .select([
      'creditAdjustment',
      'fromBillingInterval',
      'fromMonthlyCredits',
      'stripeInvoiceId',
      'toBillingInterval',
      'toMonthlyCredits',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('billingSubscriptionId', '=', subscription.id)
    .where('changeMode', '=', 'immediate')
    .where('status', '=', 'applied')
    .where('stripeInvoiceId', 'is not', null)
    .execute()
  const changeIntentByInvoice = new Map(
    changeIntents.map(intent => [intent.stripeInvoiceId!, intent]),
  )

  let grantedCredits = 0
  let grantCount = 0
  for (const period of periods) {
    const coveringPayments = payments.filter(
      candidate =>
        candidate.servicePeriodStart
        && candidate.servicePeriodEnd
        && candidate.servicePeriodStart <= period.startsAt
        && candidate.servicePeriodEnd >= period.endsAt,
    )
    const payment = coveringPayments[0]
    if (!payment?.servicePeriodStart || !payment.stripeInvoiceId)
      break
    if (
      !payment.servicePeriodEnd
      || !payment.stripeInvoiceLineItemId
      || !payment.stripePriceId
      || !payment.subscriptionGrantFactsCapturedAt
      || !payment.subscriptionCatalogRevision
      || !payment.subscriptionOfferCode
      || !payment.subscriptionRecurringOptionCode
      || !payment.subscriptionBillingInterval
      || !payment.subscriptionMonthlyCredits
      || (payment.subscriptionPlanCode !== 'creator'
        && payment.subscriptionPlanCode !== 'pro')
    ) {
      throw new Error('subscription_payment_grant_facts_missing')
    }
    let recognizedRevenueUsdCents = 0
    for (const fundingPayment of coveringPayments) {
      if (
        !fundingPayment.servicePeriodStart
        || !fundingPayment.servicePeriodEnd
        || !fundingPayment.stripeInvoiceId
        || !fundingPayment.subscriptionBillingInterval
        || !fundingPayment.subscriptionMonthlyCredits
      ) {
        throw new Error('subscription_payment_grant_facts_missing')
      }
      if (fundingPayment.subscriptionBillingInterval === 'month') {
        recognizedRevenueUsdCents += fundingPayment.amountPaidMinor
        continue
      }
      const changeIntent = changeIntentByInvoice.get(
        fundingPayment.stripeInvoiceId,
      )
      if (
        changeIntent
        && (
          changeIntent.toBillingInterval !== 'year'
          || !changeIntent.fromMonthlyCredits
          || !changeIntent.toMonthlyCredits
        )
      ) {
        throw new Error('subscription_change_revenue_facts_missing')
      }
      recognizedRevenueUsdCents += annualRevenueForGrantPeriod({
        amountUsdCents: fundingPayment.amountPaidMinor,
        anchor: subscription.originalAnchorAt,
        firstPeriodCredits:
          changeIntent?.creditAdjustment
          ?? fundingPayment.subscriptionMonthlyCredits,
        laterPeriodCredits: changeIntent
          ? changeIntent.fromBillingInterval === 'month'
            ? changeIntent.toMonthlyCredits!
            : changeIntent.toMonthlyCredits!
              - changeIntent.fromMonthlyCredits!
          : fundingPayment.subscriptionMonthlyCredits,
        periodStart: period.startsAt,
        servicePeriodEnd: fundingPayment.servicePeriodEnd,
        servicePeriodStart: fundingPayment.servicePeriodStart,
      })
    }
    const creditPeriod = await ensureSubscriptionCreditPeriod({
      billingSubscriptionId: subscription.id,
      ordinal: period.ordinal,
      organizationId: input.organizationId,
      periodEnd: period.endsAt,
      periodStart: period.startsAt,
      scheduleRevision: subscription.creditScheduleRevision,
      targetCredits: payment.subscriptionMonthlyCredits,
    }, database)
    const creditsToGrant = Math.min(
      payment.subscriptionMonthlyCredits,
      creditPeriod.targetCredits
      - creditPeriod.carriedCredits
      - creditPeriod.grantedCredits,
    )
    if (creditsToGrant <= 0)
      continue
    const result = await appendCreditGrant(
      {
        catalogRevision: payment.subscriptionCatalogRevision,
        createdBy: null,
        grantPeriodEnd: period.endsAt,
        grantPeriodStart: period.startsAt,
        idempotencyKey: `subscription:${subscription.stripeSubscriptionId}:grant:${period.startsAt.toISOString()}`,
        offerCode: payment.subscriptionOfferCode,
        organizationId: input.organizationId,
        originalCredits: creditsToGrant,
        outputPolicy: {
          outputVisibility: 'private',
          showcaseEligible: false,
        },
        planCode: payment.subscriptionPlanCode,
        recognizedRevenueUsdCents,
        source: 'subscription',
        stripeInvoiceId: payment.stripeInvoiceId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        subscriptionCreditPeriodId: creditPeriod.id,
      },
      database,
    )
    if (!result.replayed) {
      grantedCredits += creditsToGrant
      grantCount += 1
    }
  }
  return { grantedCredits, grantCount }
}

/**
 * Emits due monthly grants for one exact paid Subscription, including terminal
 * subscriptions whose delayed Invoice still authorizes a paid service period.
 */
export async function reconcileDueSubscriptionGrantsForSubscription(
  input: {
    /** Durable local Subscription whose paid Invoice facts authorize grants. */
    billingSubscriptionId: string
    /** Tenant that owns the exact Subscription. */
    organizationId: string
  },
  database: DatabaseExecutor,
  now = new Date(),
) {
  await ensureOrganizationBillingState(
    {
      catalogRevision: BILLING_CATALOG.revision,
      organizationId: input.organizationId,
    },
    database,
  )
  return reconcileSubscriptionGrantPeriods(input, database, now)
}

/** Emits every currently due grant for the organization's current Subscription. */
export async function reconcileDueSubscriptionGrants(
  organizationId: string,
  database: DatabaseExecutor,
  now = new Date(),
) {
  await ensureOrganizationBillingState(
    {
      catalogRevision: BILLING_CATALOG.revision,
      organizationId,
    },
    database,
  )
  const subscription = await database
    .selectFrom('billingSubscriptions')
    .select('id')
    .where('organizationId', '=', organizationId)
    .where('status', 'not in', ['canceled', 'incomplete_expired'])
    .executeTakeFirst()
  if (!subscription)
    return { grantedCredits: 0, grantCount: 0 }
  return reconcileSubscriptionGrantPeriods(
    {
      billingSubscriptionId: subscription.id,
      organizationId,
    },
    database,
    now,
  )
}

/** Assigns Founder status and its one-time welcome grant explicitly. */
export async function assignFounderStatus(
  input: {
    /** Administrator performing the explicit assignment. */
    assignedBy: string
    /** Tenant receiving Founder status. */
    organizationId: string
  },
  database: DatabaseExecutor,
) {
  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(
      {
        catalogRevision: BILLING_CATALOG.revision,
        organizationId: input.organizationId,
      },
      trx,
    )
    const account = await trx
      .selectFrom('organizationBillingAccounts')
      .select(['currentPlanCode', 'founderEligibleAt'])
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (account.currentPlanCode !== 'free')
      throw new Error('founder_requires_free_plan')
    if (!account.founderEligibleAt) {
      await trx
        .updateTable('organizationBillingAccounts')
        .set(eb => ({
          catalogRevision: BILLING_CATALOG.revision,
          founderAssignedBy: input.assignedBy,
          founderEligibleAt: new Date(),
          revision: eb('revision', '+', '1'),
          updatedAt: new Date(),
        }))
        .where('organizationId', '=', input.organizationId)
        .execute()
    }
    return appendCreditGrant(
      {
        catalogRevision: BILLING_CATALOG.revision,
        createdBy: input.assignedBy,
        idempotencyKey: `founder:${input.organizationId}:welcome`,
        offerCode: null,
        organizationId: input.organizationId,
        originalCredits: BILLING_CATALOG.programs.founder.oneTimeCredits,
        outputPolicy: BILLING_CATALOG.programs.founder,
        planCode: 'free',
        source: 'founder_welcome',
      },
      trx,
    )
  })
}
