/**
 * Stripe test-mode certification for signed webhooks and Checkout idempotency.
 *
 * The verifier creates only temporary test-mode Products, Prices, a Customer,
 * and open Checkout Sessions. It never supplies a payment method or creates a
 * charge, then expires and archives every temporary resource in a finally block.
 */

import type { BillingHistoricalRecurringOffer } from '@talelabs/billing'
import type { Stripe } from '../src/index.js'

import process from 'node:process'

import {
  assertStripeTestMode,
  constructStripeWebhookEvent,
  createStripeClient,
  STRIPE_API_VERSION,
  verifyHistoricalStripePrice,
} from '../src/index.js'

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(message)
}

async function verifyWebhookSignature(stripe: Stripe) {
  const secret = 'whsec_talelabs_billing_verifier'
  const payload = JSON.stringify({
    api_version: STRIPE_API_VERSION,
    created: Math.floor(Date.now() / 1_000),
    data: {
      object: {
        id: 'cs_test_talelabs_billing_verifier',
        object: 'checkout.session',
      },
    },
    id: 'evt_test_talelabs_billing_verifier',
    livemode: false,
    object: 'event',
    pending_webhooks: 0,
    type: 'checkout.session.completed',
  })
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  })
  const event = constructStripeWebhookEvent({
    payload,
    secret,
    signature,
    stripe,
  })
  invariant(event.id === 'evt_test_talelabs_billing_verifier', 'webhook_id')
  invariant(!event.livemode, 'webhook_test_mode')
  try {
    constructStripeWebhookEvent({
      payload: `${payload} `,
      secret,
      signature,
      stripe,
    })
  }
  catch {
    return
  }
  throw new Error('tampered_webhook_signature_accepted')
}

async function expireIfOpen(
  stripe: Stripe,
  session: Stripe.Checkout.Session | undefined,
) {
  if (session?.status === 'open')
    await stripe.checkout.sessions.expire(session.id)
}

async function main() {
  assertStripeTestMode()
  const stripe = createStripeClient({
    maxNetworkRetries: 2,
    timeout: 20_000,
  })
  await verifyWebhookSignature(stripe)

  const suffix = `${process.pid}-${Date.now()}`
  let product: Stripe.Product | undefined
  let recurringPrice: Stripe.Price | undefined
  let historicalPrice: Stripe.Price | undefined
  let oneTimePrice: Stripe.Price | undefined
  let customer: Stripe.Customer | Stripe.DeletedCustomer | undefined
  let subscriptionSession: Stripe.Checkout.Session | undefined
  let paymentSession: Stripe.Checkout.Session | undefined
  try {
    product = await stripe.products.create({
      metadata: {
        talelabs_billing_verifier: suffix,
      },
      name: `TaleLabs Billing Verifier ${suffix}`,
    }, {
      idempotencyKey: `talelabs-verifier-product:${suffix}`,
    })
    invariant(!product.livemode, 'live_product_refused')
    recurringPrice = await stripe.prices.create({
      currency: 'usd',
      product: product.id,
      recurring: { interval: 'month' },
      unit_amount: 100,
    }, {
      idempotencyKey: `talelabs-verifier-recurring-price:${suffix}`,
    })
    const historicalOffer: BillingHistoricalRecurringOffer = {
      billingInterval: 'month',
      catalogRevision: `billing-verifier-${suffix}`,
      monthlyCredits: 321,
      offerCode: `billing-verifier-history-${suffix}`,
      priceUsdCents: 123,
      recurringOptionCode: `billing-verifier-history-${suffix}`,
      stripeLookupKey: `talelabs_billing_verifier_history_${suffix}`,
    }
    historicalPrice = await stripe.prices.create({
      active: true,
      currency: 'usd',
      lookup_key: historicalOffer.stripeLookupKey,
      metadata: {
        talelabs_catalog_revision: historicalOffer.catalogRevision,
        talelabs_monthly_credits: String(historicalOffer.monthlyCredits),
        talelabs_offer_code: historicalOffer.offerCode,
        talelabs_plan_code: 'pro',
        talelabs_recurring_option_code:
          historicalOffer.recurringOptionCode,
      },
      product: product.id,
      recurring: { interval: historicalOffer.billingInterval },
      unit_amount: historicalOffer.priceUsdCents,
    }, {
      idempotencyKey: `talelabs-verifier-historical-price:${suffix}`,
    })
    const verifiedHistoricalPrice = await verifyHistoricalStripePrice(
      {
        offer: historicalOffer,
        planCode: 'pro',
        stripeProductId: product.id,
      },
      stripe,
    )
    let historicalRevisionDriftRejected = false
    try {
      await verifyHistoricalStripePrice(
        {
          offer: {
            ...historicalOffer,
            catalogRevision: `${historicalOffer.catalogRevision}-drift`,
          },
          planCode: 'pro',
          stripeProductId: product.id,
        },
        stripe,
      )
    }
    catch {
      historicalRevisionDriftRejected = true
    }
    const historicalPriceAfterVerification = await stripe.prices.retrieve(
      historicalPrice.id,
    )
    invariant(
      verifiedHistoricalPrice.id === historicalPrice.id
      && historicalRevisionDriftRejected
      && historicalPriceAfterVerification.active === historicalPrice.active
      && historicalPriceAfterVerification.metadata
        .talelabs_catalog_revision === historicalOffer.catalogRevision,
      'historical_price_read_only_verification',
    )
    oneTimePrice = await stripe.prices.create({
      currency: 'usd',
      product: product.id,
      unit_amount: 100,
    }, {
      idempotencyKey: `talelabs-verifier-onetime-price:${suffix}`,
    })
    customer = await stripe.customers.create({
      metadata: {
        talelabs_billing_verifier: suffix,
      },
    }, {
      idempotencyKey: `talelabs-verifier-customer:${suffix}`,
    })
    invariant(!customer.deleted && !customer.livemode, 'live_customer_refused')

    const subscriptionParams: Stripe.Checkout.SessionCreateParams = {
      cancel_url: 'https://example.invalid/billing/canceled',
      customer: customer.id,
      line_items: [{ price: recurringPrice.id, quantity: 1 }],
      metadata: { talelabs_billing_verifier: suffix },
      mode: 'subscription',
      payment_method_types: ['card'],
      success_url: 'https://example.invalid/billing/success',
    }
    const subscriptionKey = `talelabs-verifier-subscription:${suffix}`
    subscriptionSession = await stripe.checkout.sessions.create(
      subscriptionParams,
      { idempotencyKey: subscriptionKey },
    )
    const subscriptionReplay = await stripe.checkout.sessions.create(
      subscriptionParams,
      { idempotencyKey: subscriptionKey },
    )
    invariant(!subscriptionSession.livemode, 'live_checkout_refused')
    invariant(
      subscriptionReplay.id === subscriptionSession.id,
      'subscription_checkout_idempotency',
    )
    invariant(
      subscriptionSession.payment_method_types.length === 1
      && subscriptionSession.payment_method_types[0] === 'card',
      'subscription_checkout_payment_method_policy',
    )

    const paymentParams = {
      cancel_url: 'https://example.invalid/credits/canceled',
      customer: customer.id,
      line_items: [{ price: oneTimePrice.id, quantity: 1 }],
      metadata: { talelabs_billing_verifier: suffix },
      mode: 'payment' as const,
      success_url: 'https://example.invalid/credits/success',
    }
    const paymentKey = `talelabs-verifier-topup:${suffix}`
    paymentSession = await stripe.checkout.sessions.create(
      paymentParams,
      { idempotencyKey: paymentKey },
    )
    const paymentReplay = await stripe.checkout.sessions.create(
      paymentParams,
      { idempotencyKey: paymentKey },
    )
    invariant(!paymentSession.livemode, 'live_checkout_refused')
    invariant(
      paymentReplay.id === paymentSession.id,
      'topup_checkout_idempotency',
    )
    console.log(
      'Stripe test contract verified: raw-body signatures, tamper rejection, read-only historical Price certification, card-only subscription Checkout idempotency, and top-up Checkout idempotency; no charge created.',
    )
  }
  finally {
    await Promise.allSettled([
      expireIfOpen(stripe, subscriptionSession),
      expireIfOpen(stripe, paymentSession),
    ])
    if (customer && !customer.deleted)
      await stripe.customers.del(customer.id)
    if (recurringPrice)
      await stripe.prices.update(recurringPrice.id, { active: false })
    if (historicalPrice)
      await stripe.prices.update(historicalPrice.id, { active: false })
    if (oneTimePrice)
      await stripe.prices.update(oneTimePrice.id, { active: false })
    if (product)
      await stripe.products.update(product.id, { active: false })
  }
}

await main()
