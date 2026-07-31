/** Out-of-order refund and dispute recovery verification for Stripe webhooks. */

import type { StripeClient } from '@talelabs/stripe'
import type { Kysely } from 'kysely'
import type { Database } from '../src/schema.js'

import process from 'node:process'

import { expectRejected, invariant } from './billing-verifier-support.js'

async function seedTopUpPayment(input: {
  accounting: typeof import('../src/index.js')
  database: Kysely<Database>
  paymentIntentId: string
  purchaseId: string
}) {
  const organizationId = 'billing-org-zz-webhook-ordering'
  const paidAt = new Date('2027-01-02T00:00:00.000Z')
  await input.database
    .insertInto('creditPurchases')
    .values({
      amountMinor: 1_000,
      catalogRevision: '2026-07-27.5',
      credits: 100,
      currency: 'usd',
      id: input.purchaseId,
      idempotencyKey: `purchase:${input.purchaseId}`,
      membershipRateImprovementBpsFromFree: 0,
      modeledContributionMarginBps: 2_000,
      organizationId,
      paidAt,
      planCode: 'free',
      pricingPolicyVersion: '2026-07-27.5',
      status: 'paid',
      stripeCheckoutSessionId: `cs_${input.purchaseId}`,
      stripeCustomerId: 'cus_webhook_ordering',
      stripePaymentIntentId: input.paymentIntentId,
      volumeRateImprovementBps: 0,
    })
    .execute()
  const grant = await input.accounting.appendCreditGrant(
    {
      catalogRevision: '2026-07-27.5',
      createdBy: null,
      creditPurchaseId: input.purchaseId,
      idempotencyKey: `purchase:${input.purchaseId}:grant`,
      offerCode: null,
      organizationId,
      originalCredits: 100,
      outputPolicy: {
        outputVisibility: 'private',
        showcaseEligible: false,
      },
      planCode: 'free',
      recognizedRevenueUsdCents: 1_000,
      source: 'purchase',
    },
    input.database,
  )
  await input.database
    .updateTable('creditPurchases')
    .set({ creditGrantId: grant.grantId })
    .where('organizationId', '=', organizationId)
    .where('id', '=', input.purchaseId)
    .execute()
  await input.database
    .insertInto('billingPayments')
    .values({
      amountPaidMinor: 1_000,
      creditPurchaseId: input.purchaseId,
      currency: 'usd',
      id: `payment-${input.purchaseId}`,
      organizationId,
      paidAt,
      paymentKind: 'credit_topup',
      status: 'paid',
      stripeCheckoutSessionId: `cs_${input.purchaseId}`,
      stripePaymentIntentId: input.paymentIntentId,
    })
    .execute()
  return grant.grantId
}

/** Proves early refunds and disputes defer until their payment projection exists. */
export async function verifyEarlyReversalRecovery(
  database: Kysely<Database>,
  accounting: typeof import('../src/index.js'),
) {
  const organizationId = 'billing-org-zz-webhook-ordering'
  await database
    .updateTable('organizationBillingAccounts')
    .set({ stripeCustomerId: 'cus_webhook_ordering' })
    .where('organizationId', '=', organizationId)
    .execute()
  await database
    .insertInto('stripeWebhookEvents')
    .values([
      {
        eventType: 'charge.refunded',
        processingStatus: 'pending',
        stripeEventId: 'evt_refund_before_payment',
        stripeObjectId: 'ch_refund_before_payment',
      },
      {
        eventType: 'charge.dispute.created',
        processingStatus: 'pending',
        stripeEventId: 'evt_dispute_before_payment',
        stripeObjectId: 'dp_before_payment',
      },
    ])
    .execute()

  const charges = {
    ch_dispute_before_payment: {
      amount: 1_000,
      amount_refunded: 0,
      currency: 'usd',
      customer: 'cus_webhook_ordering',
      id: 'ch_dispute_before_payment',
      livemode: false,
      payment_intent: 'pi_dispute_before_payment',
    },
    ch_refund_before_payment: {
      amount: 1_000,
      amount_refunded: 1_000,
      currency: 'usd',
      customer: 'cus_webhook_ordering',
      id: 'ch_refund_before_payment',
      livemode: false,
      payment_intent: 'pi_refund_before_payment',
    },
  }
  const events = {
    evt_dispute_before_payment: {
      data: { object: { id: 'dp_before_payment' } },
      id: 'evt_dispute_before_payment',
      livemode: false,
      type: 'charge.dispute.created',
    },
    evt_refund_before_payment: {
      data: { object: { id: 'ch_refund_before_payment' } },
      id: 'evt_refund_before_payment',
      livemode: false,
      type: 'charge.refunded',
    },
  }
  const stripe = {
    charges: {
      retrieve: async (id: keyof typeof charges) => charges[id],
    },
    disputes: {
      retrieve: async () => ({
        amount: 1_000,
        charge: 'ch_dispute_before_payment',
        currency: 'usd',
        id: 'dp_before_payment',
        livemode: false,
        payment_intent: 'pi_dispute_before_payment',
        status: 'needs_response',
      }),
    },
    events: {
      retrieve: async (id: keyof typeof events) => events[id],
    },
  } as unknown as StripeClient
  process.env.STRIPE_SECRET_KEY = 'sk_test_billing_verifier'
  const webhook
    = await import('../../trigger/src/billing/webhook-processor.js')

  for (const stripeEventId of [
    'evt_refund_before_payment',
    'evt_dispute_before_payment',
  ]) {
    await expectRejected(
      () => webhook.processStripeWebhookEvent(stripeEventId, database, stripe),
      `${stripeEventId}_must_defer`,
    )
    const inbox = await database
      .selectFrom('stripeWebhookEvents')
      .select(['lastErrorCode', 'processedAt', 'processingStatus'])
      .where('stripeEventId', '=', stripeEventId)
      .executeTakeFirstOrThrow()
    invariant(
      inbox.processingStatus === 'failed'
      && inbox.processedAt === null
      && inbox.lastErrorCode === 'stripe_payment_projection_pending',
      `${stripeEventId}_discarded_before_payment`,
    )
  }

  const refundGrantId = await seedTopUpPayment({
    accounting,
    database,
    paymentIntentId: 'pi_refund_before_payment',
    purchaseId: 'refund-before-payment',
  })
  const disputeGrantId = await seedTopUpPayment({
    accounting,
    database,
    paymentIntentId: 'pi_dispute_before_payment',
    purchaseId: 'dispute-before-payment',
  })
  await webhook.processStripeWebhookEvent(
    'evt_refund_before_payment',
    database,
    stripe,
  )
  await webhook.processStripeWebhookEvent(
    'evt_dispute_before_payment',
    database,
    stripe,
  )
  const [refundPayment, disputePayment, refundGrant, disputeGrant]
    = await Promise.all([
      database
        .selectFrom('billingPayments')
        .select(['refundedAmountMinor', 'status'])
        .where('stripePaymentIntentId', '=', 'pi_refund_before_payment')
        .executeTakeFirstOrThrow(),
      database
        .selectFrom('billingPayments')
        .select('status')
        .where('stripePaymentIntentId', '=', 'pi_dispute_before_payment')
        .executeTakeFirstOrThrow(),
      database
        .selectFrom('creditGrants')
        .select('reversedCredits')
        .where('id', '=', refundGrantId)
        .executeTakeFirstOrThrow(),
      database
        .selectFrom('creditGrants')
        .select('reversedCredits')
        .where('id', '=', disputeGrantId)
        .executeTakeFirstOrThrow(),
    ])
  invariant(
    refundPayment.status === 'refunded'
    && refundPayment.refundedAmountMinor === 1_000
    && refundGrant.reversedCredits === 100,
    'deferred_refund_not_recovered',
  )
  invariant(
    disputePayment.status === 'disputed'
    && disputeGrant.reversedCredits === 100,
    'deferred_dispute_not_recovered',
  )
  const succeededEvents = await database
    .selectFrom('stripeWebhookEvents')
    .select(['processedAt', 'processingStatus'])
    .where('stripeEventId', 'in', [
      'evt_refund_before_payment',
      'evt_dispute_before_payment',
    ])
    .execute()
  invariant(
    succeededEvents.length === 2
    && succeededEvents.every(
      event =>
        event.processingStatus === 'succeeded' && event.processedAt !== null,
    ),
    'deferred_reversal_inbox_not_completed',
  )
}
