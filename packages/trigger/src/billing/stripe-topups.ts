/** Stripe Checkout fulfillment for one-time non-expiring credit purchases. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import { createId } from '@paralleldrive/cuid2'
import { BILLING_CATALOG } from '@talelabs/billing'
import {
  appendCreditGrant,
  db,
  withDatabaseTransaction,
} from '@talelabs/db'
import {
  assertStripeTestMode,
  stripeClient,
} from '@talelabs/stripe'

import {
  assertStripeTestResource,
  retrieveStripeSettlementFacts,
  stripeObjectId,
} from './stripe-facts.js'

function paidCheckoutTimestamp(session: Stripe.Checkout.Session) {
  return new Date(session.created * 1_000)
}

/** Fulfills a currently paid top-up Checkout Session exactly once. */
export async function fulfillPaidTopUpCheckout(
  stripeCheckoutSessionId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  assertStripeTestMode()
  const session = await stripe.checkout.sessions.retrieve(
    stripeCheckoutSessionId,
  )
  assertStripeTestResource(session, 'checkout_session')
  if (session.mode !== 'payment' || session.payment_status !== 'paid')
    return { fulfilled: false as const }
  const organizationId = session.metadata?.talelabs_organization_id
  const purchaseId = session.metadata?.talelabs_credit_purchase_id
  if (!organizationId || !purchaseId)
    throw new Error('stripe_topup_metadata_missing')
  const [account, purchase] = await Promise.all([
    database.selectFrom('organizationBillingAccounts')
      .select('stripeCustomerId')
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('creditPurchases')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('id', '=', purchaseId)
      .executeTakeFirstOrThrow(),
  ])
  const customerId = stripeObjectId(session.customer)
  const paymentIntentId = stripeObjectId(session.payment_intent)
  if (
    session.metadata?.talelabs_catalog_revision !== purchase.catalogRevision
    || customerId !== account.stripeCustomerId
    || customerId !== purchase.stripeCustomerId
    || session.amount_total !== purchase.amountMinor
    || session.currency !== purchase.currency
    || !paymentIntentId
    || (
      purchase.stripeCheckoutSessionId
      && purchase.stripeCheckoutSessionId !== session.id
    )
  ) {
    throw new Error('stripe_topup_purchase_mismatch')
  }
  const settlement = await retrieveStripeSettlementFacts(
    session.payment_intent,
    stripe,
  )
  const paidAt = paidCheckoutTimestamp(session)

  return withDatabaseTransaction(database, async (trx) => {
    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const locked = await trx.selectFrom('creditPurchases')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('id', '=', purchaseId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (locked.status === 'paid' && locked.creditGrantId) {
      return {
        fulfilled: true as const,
        grantId: locked.creditGrantId,
        replayed: true as const,
      }
    }
    if (
      locked.status === 'partially_refunded'
      || locked.status === 'refunded'
      || locked.status === 'disputed'
    ) {
      throw new Error('stripe_topup_terminal_purchase_replayed')
    }
    const existingPayment = await trx.selectFrom('billingPayments')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('creditPurchaseId', '=', locked.id)
      .executeTakeFirst()
    if (!existingPayment) {
      await trx.insertInto('billingPayments').values({
        amountPaidMinor: locked.amountMinor,
        creditPurchaseId: locked.id,
        currency: locked.currency,
        id: createId(),
        organizationId,
        paidAt,
        paymentKind: 'credit_topup',
        status: 'paid',
        stripeCheckoutSessionId: session.id,
        ...settlement,
      }).execute()
    }
    const grant = await appendCreditGrant({
      catalogRevision: locked.catalogRevision,
      createdBy: null,
      creditPurchaseId: locked.id,
      idempotencyKey: `purchase:${locked.id}:grant`,
      offerCode: null,
      organizationId,
      originalCredits: locked.credits,
      outputPolicy: {
        outputVisibility: BILLING_CATALOG.topUps.outputVisibility,
        showcaseEligible: BILLING_CATALOG.topUps.showcaseEligible,
      },
      planCode: locked.planCode,
      recognizedRevenueUsdCents: locked.amountMinor,
      source: 'purchase',
    }, trx)
    await trx.updateTable('creditPurchases')
      .set({
        creditGrantId: grant.grantId,
        paidAt,
        status: 'paid',
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', organizationId)
      .where('id', '=', locked.id)
      .execute()
    return {
      fulfilled: true as const,
      grantId: grant.grantId,
      replayed: false as const,
    }
  })
}

/** Records terminal unpaid Checkout outcomes without creating credit grants. */
export async function failTopUpCheckout(input: {
  /** Durable Stripe Checkout Session identity. */
  stripeCheckoutSessionId: string
  /** Stable local terminal status. */
  status: 'expired' | 'failed'
}, database: DatabaseExecutor = db, stripe: StripeClient = stripeClient) {
  assertStripeTestMode()
  const session = await stripe.checkout.sessions.retrieve(
    input.stripeCheckoutSessionId,
  )
  assertStripeTestResource(session, 'checkout_session')
  if (session.mode !== 'payment')
    return false
  const organizationId = session.metadata?.talelabs_organization_id
  const purchaseId = session.metadata?.talelabs_credit_purchase_id
  if (!organizationId || !purchaseId)
    throw new Error('stripe_topup_metadata_missing')
  const updated = await database.updateTable('creditPurchases')
    .set({
      status: input.status,
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', organizationId)
    .where('id', '=', purchaseId)
    .where('status', '=', 'pending')
    .returning('id')
    .executeTakeFirst()
  return Boolean(updated)
}
