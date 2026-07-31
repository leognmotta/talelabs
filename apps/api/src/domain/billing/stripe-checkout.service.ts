/** Stripe-hosted subscription, top-up, and Customer Portal session workflows. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { StripeClient } from '@talelabs/stripe'

import { createHash } from 'node:crypto'

import { createId } from '@paralleldrive/cuid2'
import {
  BILLING_CATALOG,
  getBillingOffer,
  quoteTopUp,
} from '@talelabs/billing'
import {
  db,
  ensureOrganizationBillingState,
  reconcileExpiredPaidEntitlement,
  withDatabaseTransaction,
} from '@talelabs/db'
import {
  STRIPE_INTEGRATION_IDENTIFIER,
  stripeClient,
} from '@talelabs/stripe'

import { HttpError } from '../../middleware/error.js'
import {
  createBillingReturnUrl,
  ensureStripeCustomer,
  ensureStripePortalConfiguration,
  resolveStripeBillingPrice,
  resolveStripeCreditsProduct,
} from './stripe-resources.service.js'
import {
  admitSubscriptionCheckoutIntent,
  attachSubscriptionCheckoutSession,
  releaseSubscriptionCheckoutIntentLease,
} from './subscription-checkout-intent.service.js'

function requestDigest(idempotencyKey: string) {
  return createHash('sha256').update(idempotencyKey).digest('hex')
}

function assertCatalogRevision(revision: string) {
  if (revision !== BILLING_CATALOG.revision) {
    throw new HttpError(
      409,
      'billing_catalog_mismatch',
      'The billing catalog changed. Refresh before continuing.',
    )
  }
}

/** Creates an idempotent Stripe subscription Checkout Session. */
export async function createSubscriptionCheckout(input: {
  /** Monthly or annual customer cadence. */
  billingInterval: 'month' | 'year'
  /** Current browser catalog revision. */
  catalogRevision: string
  /** Required caller-selected request identity. */
  idempotencyKey: string
  /** Active authenticated tenant. */
  organizationId: string
  /** Creator or Pro plan requested by the organization. */
  planCode: 'creator' | 'pro'
  /** Exact recurring allowance within the requested plan. */
  recurringOptionCode: string
}, database: DatabaseExecutor = db, stripe: StripeClient = stripeClient) {
  assertCatalogRevision(input.catalogRevision)
  const resolved = getBillingOffer(input)
  if (!resolved) {
    throw new HttpError(
      409,
      'billing_offer_unavailable',
      'The selected billing offer is unavailable.',
    )
  }
  const customer = await ensureStripeCustomer(
    input.organizationId,
    database,
    stripe,
  )
  const price = await resolveStripeBillingPrice({
    billingInterval: input.billingInterval,
    catalogRevision: resolved.offer.catalogRevision,
    monthlyCredits: resolved.option.monthlyCredits,
    offerCode: resolved.offer.offerCode,
    planCode: input.planCode,
    priceUsdCents: resolved.offer.priceUsdCents,
    recurringOptionCode: input.recurringOptionCode,
    stripeLookupKey: resolved.offer.stripeLookupKey,
  }, stripe)
  const metadata = {
    talelabs_catalog_revision: resolved.offer.catalogRevision,
    talelabs_offer_code: resolved.offer.offerCode,
    talelabs_organization_id: input.organizationId,
    talelabs_plan_code: input.planCode,
    talelabs_recurring_option_code: input.recurringOptionCode,
  }
  const admitted = await admitSubscriptionCheckoutIntent({
    ...input,
    offerCode: resolved.offer.offerCode,
  }, database)
  const intentMetadata = {
    ...metadata,
    talelabs_subscription_checkout_intent_id: admitted.intent.id,
  }
  let session
  if (admitted.intent.stripeCheckoutSessionId) {
    session = await stripe.checkout.sessions.retrieve(
      admitted.intent.stripeCheckoutSessionId,
    )
  }
  else {
    try {
      session = await stripe.checkout.sessions.create({
        cancel_url: createBillingReturnUrl('plans', 'canceled'),
        client_reference_id: input.organizationId,
        customer: customer.id,
        expires_at: Math.floor(admitted.intent.expiresAt.getTime() / 1_000),
        integration_identifier: STRIPE_INTEGRATION_IDENTIFIER,
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: intentMetadata,
        mode: 'subscription',
        payment_method_types: ['card'],
        subscription_data: { metadata: intentMetadata },
        success_url: createBillingReturnUrl('plans', 'success'),
      }, {
        idempotencyKey: `talelabs:subscription-intent:${admitted.intent.id}`,
      })
      if (!admitted.leaseToken)
        throw new Error('subscription_checkout_intent_lease_missing')
      await attachSubscriptionCheckoutSession({
        intentId: admitted.intent.id,
        leaseToken: admitted.leaseToken,
        organizationId: input.organizationId,
        stripeCheckoutSessionId: session.id,
      }, database)
    }
    catch (error) {
      if (admitted.leaseToken) {
        await releaseSubscriptionCheckoutIntentLease({
          intentId: admitted.intent.id,
          leaseToken: admitted.leaseToken,
          organizationId: input.organizationId,
        }, database)
      }
      throw error
    }
  }
  if (session.livemode)
    throw new Error('Live-mode Stripe Checkout Session was refused.')
  if (
    session.mode !== 'subscription'
    || session.metadata?.talelabs_subscription_checkout_intent_id
    !== admitted.intent.id
  ) {
    throw new Error('stripe_subscription_checkout_intent_mismatch')
  }
  if (!session.url) {
    throw new HttpError(
      503,
      'stripe_checkout_unavailable',
      'Stripe Checkout did not return a hosted URL.',
    )
  }
  return { url: session.url }
}

async function admitTopUpPurchase(input: {
  amountUsdCents: number
  idempotencyKey: string
  organizationId: string
  stripeCustomerId: string
}, database: DatabaseExecutor) {
  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState({
      catalogRevision: BILLING_CATALOG.revision,
      organizationId: input.organizationId,
    }, trx)
    await reconcileExpiredPaidEntitlement(input.organizationId, trx)
    const account = await trx.selectFrom('organizationBillingAccounts')
      .select([
        'currentPlanCode',
        'currentRecurringOptionCode',
        'managedExecutionStatus',
        'stripeCustomerId',
      ])
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (account.stripeCustomerId !== input.stripeCustomerId) {
      throw new HttpError(
        409,
        'idempotency_conflict',
        'The billing customer changed while the purchase was being admitted.',
      )
    }
    if (account.managedExecutionStatus === 'blocked_review') {
      throw new HttpError(
        409,
        'topup_not_available',
        'Credit purchases are unavailable while billing is under review.',
      )
    }
    const quote = (() => {
      try {
        return quoteTopUp({
          amountUsdCents: input.amountUsdCents,
          planCode: account.currentPlanCode,
          recurringOptionCode: account.currentRecurringOptionCode,
        })
      }
      catch (error) {
        if (
          error instanceof RangeError
          && error.message === 'invalid_topup_amount'
        ) {
          throw new HttpError(
            400,
            'invalid_topup_amount',
            'The top-up amount is not an accepted catalog point.',
          )
        }
        throw error
      }
    })()
    const existing = await trx.selectFrom('creditPurchases')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (existing) {
      if (
        existing.amountMinor !== input.amountUsdCents
        || existing.credits !== quote.credits
        || existing.catalogRevision !== quote.catalogRevision
      ) {
        throw new HttpError(
          409,
          'idempotency_conflict',
          'Idempotency-Key was already used for a different purchase.',
        )
      }
      return existing
    }
    const purchase = {
      amountMinor: quote.amountUsdCents,
      catalogRevision: quote.catalogRevision,
      credits: quote.credits,
      currency: BILLING_CATALOG.currency,
      id: createId(),
      idempotencyKey: input.idempotencyKey,
      membershipRateImprovementBpsFromFree:
        quote.planRateImprovementBpsFromFree,
      modeledContributionMarginBps: quote.modeledContributionMarginBps,
      organizationId: input.organizationId,
      planCode: quote.pricingPlanCode,
      pricingPolicyVersion: quote.catalogRevision,
      recurringOptionCode: quote.pricingRecurringOptionCode,
      status: 'pending' as const,
      stripeCustomerId: input.stripeCustomerId,
      volumeRateImprovementBps: quote.volumeRateImprovementBps,
    }
    await trx.insertInto('creditPurchases').values(purchase).execute()
    return {
      ...purchase,
      createdAt: new Date(),
      creditGrantId: null,
      paidAt: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      updatedAt: new Date(),
    }
  })
}

/** Creates an idempotent one-time credit top-up Checkout Session. */
export async function createTopUpCheckout(input: {
  /** Exact accepted USD-cent slider point. */
  amountUsdCents: number
  /** Required caller-selected request identity. */
  idempotencyKey: string
  /** Active authenticated tenant. */
  organizationId: string
}, database: DatabaseExecutor = db, stripe: StripeClient = stripeClient) {
  const customer = await ensureStripeCustomer(
    input.organizationId,
    database,
    stripe,
  )
  const purchase = await admitTopUpPurchase({
    ...input,
    stripeCustomerId: customer.id,
  }, database)
  const product = await resolveStripeCreditsProduct(stripe)
  const metadata = {
    talelabs_catalog_revision: purchase.catalogRevision,
    talelabs_credit_purchase_id: purchase.id,
    talelabs_organization_id: input.organizationId,
  }
  const session = await stripe.checkout.sessions.create({
    cancel_url: createBillingReturnUrl('credits', 'canceled'),
    client_reference_id: input.organizationId,
    customer: customer.id,
    integration_identifier: STRIPE_INTEGRATION_IDENTIFIER,
    line_items: [{
      price_data: {
        currency: BILLING_CATALOG.currency,
        product: product.id,
        unit_amount: purchase.amountMinor,
      },
      quantity: 1,
    }],
    metadata,
    mode: 'payment',
    payment_intent_data: { metadata },
    success_url: createBillingReturnUrl('credits', 'success'),
  }, {
    idempotencyKey:
      `talelabs:topup:${purchase.id}:${purchase.amountMinor}:${
        requestDigest(input.idempotencyKey)}`,
  })
  if (session.livemode)
    throw new Error('Live-mode Stripe Checkout Session was refused.')
  if (!session.url) {
    throw new HttpError(
      503,
      'stripe_checkout_unavailable',
      'Stripe Checkout did not return a hosted URL.',
    )
  }
  await database.updateTable('creditPurchases')
    .set({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', purchase.id)
    .where(eb => eb.or([
      eb('stripeCheckoutSessionId', 'is', null),
      eb('stripeCheckoutSessionId', '=', session.id),
    ]))
    .executeTakeFirstOrThrow()
  return { url: session.url }
}

/** Creates a short-lived Stripe Customer Portal Session. */
export async function createCustomerPortalSession(
  organizationId: string,
  database: DatabaseExecutor = db,
  stripe: StripeClient = stripeClient,
) {
  const customer = await ensureStripeCustomer(
    organizationId,
    database,
    stripe,
  )
  const configuration = await ensureStripePortalConfiguration(stripe)
  const session = await stripe.billingPortal.sessions.create({
    configuration: configuration.id,
    customer: customer.id,
    return_url: createBillingReturnUrl('plans'),
  })
  if (session.livemode)
    throw new Error('Live-mode Stripe Portal Session was refused.')
  return { url: session.url }
}
