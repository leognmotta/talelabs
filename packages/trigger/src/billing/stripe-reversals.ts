/** Current-resource refund review and reversible Stripe dispute accounting. */

import type {
  BillingPaymentDisputeStatus,
  DatabaseExecutor,
} from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import {
  db,
  reinstateReversedCreditGrant,
  reverseUnusedCreditGrant,
  withDatabaseTransaction,
} from '@talelabs/db'
import { assertStripeTestMode, stripeClient } from '@talelabs/stripe'

import { assertStripeTestResource, stripeObjectId } from './stripe-facts.js'

async function resolveKnownCustomerOrganization(
  customer: Stripe.Charge['customer'],
  database: DatabaseExecutor,
) {
  const stripeCustomerId = stripeObjectId(customer)
  if (!stripeCustomerId)
    return null
  return database
    .selectFrom('organizationBillingAccounts')
    .select('organizationId')
    .where('stripeCustomerId', '=', stripeCustomerId)
    .executeTakeFirst()
}

async function findPaymentGrants(
  input: {
    creditPurchaseId: null | string
    organizationId: string
    stripeInvoiceId: null | string
  },
  database: DatabaseExecutor,
) {
  return input.creditPurchaseId
    ? database
        .selectFrom('creditGrants')
        .select(['capturedCredits', 'id', 'reservedCredits'])
        .where('organizationId', '=', input.organizationId)
        .where('creditPurchaseId', '=', input.creditPurchaseId)
        .orderBy('id')
        .execute()
    : database
        .selectFrom('creditGrants')
        .select(['capturedCredits', 'id', 'reservedCredits'])
        .where('organizationId', '=', input.organizationId)
        .where('stripeInvoiceId', '=', input.stripeInvoiceId)
        .orderBy('id')
        .execute()
}

async function updatePurchaseStatus(
  input: {
    creditPurchaseId: null | string
    organizationId: string
    refundedAmountMinor?: number
    status: 'disputed' | 'paid' | 'partially_refunded' | 'refunded'
  },
  database: DatabaseExecutor,
) {
  if (!input.creditPurchaseId)
    return
  await database
    .updateTable('creditPurchases')
    .set({
      ...(input.refundedAmountMinor === undefined
        ? {}
        : { refundedAmountMinor: input.refundedAmountMinor }),
      status: input.status,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.creditPurchaseId)
    .execute()
}

async function restoreExecutionAfterResolution(
  organizationId: string,
  database: DatabaseExecutor,
) {
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select(['managedExecutionReason', 'managedExecutionStatus'])
    .where('organizationId', '=', organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  if (
    account.managedExecutionStatus !== 'blocked_review'
    || ![
      'partial_refund_manual_review',
      'payment_disputed',
      'payment_refunded',
    ].includes(account.managedExecutionReason ?? '')
  ) {
    return
  }
  const [unresolvedDispute, partialRefund, subscription] = await Promise.all([
    database
      .selectFrom('billingPaymentDisputes')
      .select('stripeDisputeId')
      .where('organizationId', '=', organizationId)
      .where('status', 'in', ['open', 'lost'])
      .executeTakeFirst(),
    database
      .selectFrom('billingPayments')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('status', '=', 'partially_refunded')
      .executeTakeFirst(),
    database
      .selectFrom('billingSubscriptions')
      .select('status')
      .where('organizationId', '=', organizationId)
      .where('status', 'not in', ['canceled', 'incomplete_expired'])
      .executeTakeFirst(),
  ])
  if (unresolvedDispute || partialRefund)
    return
  const pastDue
    = subscription && ['past_due', 'unpaid'].includes(subscription.status)
  await database
    .updateTable('organizationBillingAccounts')
    .set(eb => ({
      managedExecutionReason: pastDue ? 'subscription_payment_past_due' : null,
      managedExecutionStatus: pastDue ? 'past_due' : 'active',
      revision: eb('revision', '+', '1'),
      updatedAt: new Date(),
    }))
    .where('organizationId', '=', organizationId)
    .execute()
}

async function markPartialRefundForReview(
  input: {
    creditPurchaseId: null | string
    organizationId: string
    paymentId: string
    refundedAmountMinor: number
  },
  database: DatabaseExecutor,
) {
  await database
    .updateTable('billingPayments')
    .set({
      refundedAmountMinor: input.refundedAmountMinor,
      status: 'partially_refunded',
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.paymentId)
    .execute()
  await updatePurchaseStatus(
    {
      creditPurchaseId: input.creditPurchaseId,
      organizationId: input.organizationId,
      refundedAmountMinor: input.refundedAmountMinor,
      status: 'partially_refunded',
    },
    database,
  )
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select(['managedExecutionReason', 'managedExecutionStatus'])
    .where('organizationId', '=', input.organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  if (account.managedExecutionStatus !== 'blocked_review') {
    await database
      .updateTable('organizationBillingAccounts')
      .set(eb => ({
        managedExecutionReason: 'partial_refund_manual_review',
        managedExecutionStatus: 'blocked_review',
        revision: eb('revision', '+', '1'),
        updatedAt: new Date(),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
  }
}

async function markDisputeForReview(
  input: {
    creditPurchaseId: null | string
    organizationId: string
    paymentId: string
  },
  database: DatabaseExecutor,
) {
  await database
    .updateTable('billingPayments')
    .set({ status: 'disputed', updatedAt: new Date() })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.paymentId)
    .execute()
  await updatePurchaseStatus(
    {
      creditPurchaseId: input.creditPurchaseId,
      organizationId: input.organizationId,
      status: 'disputed',
    },
    database,
  )
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select('managedExecutionStatus')
    .where('organizationId', '=', input.organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  if (account.managedExecutionStatus !== 'blocked_review') {
    await database
      .updateTable('organizationBillingAccounts')
      .set(eb => ({
        managedExecutionReason: 'payment_disputed',
        managedExecutionStatus: 'blocked_review',
        revision: eb('revision', '+', '1'),
        updatedAt: new Date(),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
  }
}

/** Reviews partial refunds manually and fully revokes only full refunds. */
export async function processRefundedStripeCharge(
  input: {
    /** Signed Stripe event identity retained by the webhook inbox. */
    eventId: string
    /** Current Stripe Charge identity. */
    stripeChargeId: string
  },
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const charge = await stripe.charges.retrieve(input.stripeChargeId)
  assertStripeTestResource(charge, 'charge')
  if (charge.amount_refunded < 1)
    return { deferred: false as const, matched: false as const }
  const paymentIntentId = stripeObjectId(charge.payment_intent)
  if (!paymentIntentId)
    return { deferred: false as const, matched: false as const }
  const customerOrganization = await resolveKnownCustomerOrganization(
    charge.customer,
    database,
  )

  return withDatabaseTransaction(database, async (trx) => {
    const payment = await trx
      .selectFrom('billingPayments')
      .selectAll()
      .where('stripePaymentIntentId', '=', paymentIntentId)
      .forUpdate()
      .executeTakeFirst()
    if (!payment) {
      return {
        deferred:
          customerOrganization !== undefined && customerOrganization !== null,
        matched: false as const,
      }
    }
    if (
      customerOrganization?.organizationId !== payment.organizationId
      || charge.currency !== payment.currency
      || charge.amount !== payment.amountPaidMinor
      || charge.amount_refunded > payment.amountPaidMinor
    ) {
      throw new Error('stripe_refund_payment_mismatch')
    }
    if (charge.amount_refunded < payment.refundedAmountMinor)
      throw new Error('stripe_refund_amount_regressed')
    if (charge.amount_refunded < charge.amount) {
      await markPartialRefundForReview(
        {
          creditPurchaseId: payment.creditPurchaseId,
          organizationId: payment.organizationId,
          paymentId: payment.id,
          refundedAmountMinor: charge.amount_refunded,
        },
        trx,
      )
      return {
        matched: true as const,
        organizationId: payment.organizationId,
        reviewRequired: true as const,
      }
    }

    const grants = await findPaymentGrants(payment, trx)
    let consumed = grants.some(
      grant => grant.capturedCredits > 0 || grant.reservedCredits > 0,
    )
    for (const grant of grants) {
      const reversal = await reverseUnusedCreditGrant(
        {
          creditGrantId: grant.id,
          idempotencyKey: `refund:${charge.id}:grant:${grant.id}:reverse`,
          organizationId: payment.organizationId,
          reasonCode: 'payment_refunded',
        },
        trx,
      )
      consumed ||= reversal.consumed
    }
    await trx
      .updateTable('billingPayments')
      .set({
        refundedAmountMinor: charge.amount_refunded,
        status: 'refunded',
        updatedAt: new Date(),
      })
      .where('organizationId', '=', payment.organizationId)
      .where('id', '=', payment.id)
      .execute()
    await updatePurchaseStatus(
      {
        creditPurchaseId: payment.creditPurchaseId,
        organizationId: payment.organizationId,
        refundedAmountMinor: charge.amount_refunded,
        status: 'refunded',
      },
      trx,
    )
    if (!consumed)
      await restoreExecutionAfterResolution(payment.organizationId, trx)
    return {
      matched: true as const,
      organizationId: payment.organizationId,
      reviewRequired: consumed,
    }
  })
}

function normalizeDisputeStatus(
  status: Stripe.Dispute.Status,
): BillingPaymentDisputeStatus {
  switch (status) {
    case 'lost':
      return 'lost'
    case 'prevented':
      return 'prevented'
    case 'warning_closed':
      return 'warning_closed'
    case 'won':
      return 'won'
    default:
      return 'open'
  }
}

function isFavorableDisputeOutcome(status: BillingPaymentDisputeStatus) {
  return (
    status === 'prevented' || status === 'warning_closed' || status === 'won'
  )
}

/** Reverses adverse disputes and restores their exact unused credits after a win. */
export async function processStripeDispute(
  input: {
    /** Signed Stripe event identity retained by the webhook inbox. */
    eventId: string
    /** Current Stripe Dispute identity. */
    stripeDisputeId: string
  },
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const dispute = await stripe.disputes.retrieve(input.stripeDisputeId)
  assertStripeTestResource(dispute, 'dispute')
  const paymentIntentId = stripeObjectId(dispute.payment_intent)
  if (!paymentIntentId)
    return { deferred: false as const, matched: false as const }
  const status = normalizeDisputeStatus(dispute.status)
  const charge
    = typeof dispute.charge === 'string'
      ? await stripe.charges.retrieve(dispute.charge)
      : dispute.charge
  assertStripeTestResource(charge, 'charge')
  if (stripeObjectId(charge.payment_intent) !== paymentIntentId)
    throw new Error('stripe_dispute_charge_mismatch')
  const customerOrganization = await resolveKnownCustomerOrganization(
    charge.customer,
    database,
  )

  return withDatabaseTransaction(database, async (trx) => {
    const payment = await trx
      .selectFrom('billingPayments')
      .selectAll()
      .where('stripePaymentIntentId', '=', paymentIntentId)
      .forUpdate()
      .executeTakeFirst()
    if (!payment) {
      return {
        deferred:
          customerOrganization !== undefined && customerOrganization !== null,
        matched: false as const,
      }
    }
    if (
      customerOrganization?.organizationId !== payment.organizationId
      || dispute.currency !== payment.currency
    ) {
      throw new Error('stripe_dispute_payment_mismatch')
    }

    const resolvedAt = status === 'open' ? null : new Date()
    await trx
      .insertInto('billingPaymentDisputes')
      .values({
        amountMinor: dispute.amount,
        billingPaymentId: payment.id,
        currency: dispute.currency,
        organizationId: payment.organizationId,
        resolvedAt,
        status,
        stripeDisputeId: dispute.id,
      })
      .onConflict(conflict =>
        conflict.column('stripeDisputeId').doUpdateSet({
          amountMinor: dispute.amount,
          resolvedAt,
          status,
          updatedAt: new Date(),
        }),
      )
      .execute()

    const grants = await findPaymentGrants(payment, trx)
    if (
      (status === 'open' || status === 'lost')
      && payment.status !== 'refunded'
    ) {
      if (dispute.amount !== payment.amountPaidMinor) {
        await markDisputeForReview(
          {
            creditPurchaseId: payment.creditPurchaseId,
            organizationId: payment.organizationId,
            paymentId: payment.id,
          },
          trx,
        )
        return {
          matched: true as const,
          organizationId: payment.organizationId,
          reviewRequired: true as const,
        }
      }
      let consumed = false
      for (const grant of grants) {
        const existing = await trx
          .selectFrom('billingDisputeGrantReversals')
          .select('creditGrantId')
          .where('organizationId', '=', payment.organizationId)
          .where('stripeDisputeId', '=', dispute.id)
          .where('creditGrantId', '=', grant.id)
          .executeTakeFirst()
        if (existing)
          continue
        const reversal = await reverseUnusedCreditGrant(
          {
            creditGrantId: grant.id,
            idempotencyKey: `dispute:${dispute.id}:grant:${grant.id}:reverse`,
            organizationId: payment.organizationId,
            reasonCode: 'payment_disputed',
          },
          trx,
        )
        consumed ||= reversal.consumed
        if (reversal.reversedCredits > 0) {
          await trx
            .insertInto('billingDisputeGrantReversals')
            .values({
              creditGrantId: grant.id,
              organizationId: payment.organizationId,
              reinstatedCredits: 0,
              reversedCredits: reversal.reversedCredits,
              stripeDisputeId: dispute.id,
            })
            .execute()
        }
      }
      await trx
        .updateTable('billingPayments')
        .set({ status: 'disputed', updatedAt: new Date() })
        .where('organizationId', '=', payment.organizationId)
        .where('id', '=', payment.id)
        .execute()
      await updatePurchaseStatus(
        {
          creditPurchaseId: payment.creditPurchaseId,
          organizationId: payment.organizationId,
          status: 'disputed',
        },
        trx,
      )
      return {
        matched: true as const,
        organizationId: payment.organizationId,
        reviewRequired: consumed || status === 'lost',
      }
    }

    if (isFavorableDisputeOutcome(status)) {
      const reversalRows = await trx
        .selectFrom('billingDisputeGrantReversals')
        .selectAll()
        .where('organizationId', '=', payment.organizationId)
        .where('stripeDisputeId', '=', dispute.id)
        .orderBy('creditGrantId')
        .execute()
      if (payment.refundedAmountMinor < payment.amountPaidMinor) {
        for (const reversal of reversalRows) {
          const credits = reversal.reversedCredits - reversal.reinstatedCredits
          if (credits < 1)
            continue
          await reinstateReversedCreditGrant(
            {
              credits,
              creditGrantId: reversal.creditGrantId,
              idempotencyKey: `dispute:${dispute.id}:grant:${reversal.creditGrantId}:reinstate`,
              organizationId: payment.organizationId,
              reasonCode: 'payment_dispute_reinstated',
            },
            trx,
          )
          await trx
            .updateTable('billingDisputeGrantReversals')
            .set({
              reinstatedCredits: reversal.reversedCredits,
              updatedAt: new Date(),
            })
            .where('organizationId', '=', payment.organizationId)
            .where('stripeDisputeId', '=', dispute.id)
            .where('creditGrantId', '=', reversal.creditGrantId)
            .execute()
        }
      }
      const fullyRefunded
        = payment.refundedAmountMinor >= payment.amountPaidMinor
      const restoredStatus = fullyRefunded
        ? ('refunded' as const)
        : payment.refundedAmountMinor > 0
          ? ('partially_refunded' as const)
          : ('paid' as const)
      await trx
        .updateTable('billingPayments')
        .set({ status: restoredStatus, updatedAt: new Date() })
        .where('organizationId', '=', payment.organizationId)
        .where('id', '=', payment.id)
        .execute()
      await updatePurchaseStatus(
        {
          creditPurchaseId: payment.creditPurchaseId,
          organizationId: payment.organizationId,
          status: restoredStatus,
        },
        trx,
      )
      if (!fullyRefunded)
        await restoreExecutionAfterResolution(payment.organizationId, trx)
    }
    return {
      matched: true as const,
      organizationId: payment.organizationId,
      reviewRequired: status === 'lost',
    }
  })
}
