/** Current-resource dispatch for payment and subscription Checkout events. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { StripeClient } from '@talelabs/stripe'

import { db } from '@talelabs/db'
import { stripeClient } from '@talelabs/stripe'

import { assertStripeTestResource, stripeObjectId } from './stripe-facts.js'
import { projectStripeSubscription } from './stripe-subscriptions.js'
import {
  failTopUpCheckout,
  fulfillPaidTopUpCheckout,
} from './stripe-topups.js'

type CheckoutTerminalEvent
  = | 'checkout.session.async_payment_failed'
    | 'checkout.session.async_payment_succeeded'
    | 'checkout.session.completed'
    | 'checkout.session.expired'

async function projectSubscriptionCheckout(input: {
  eventType: CheckoutTerminalEvent
  stripeCheckoutSessionId: string
}, database: DatabaseExecutor, stripe: StripeClient) {
  const session = await stripe.checkout.sessions.retrieve(
    input.stripeCheckoutSessionId,
  )
  assertStripeTestResource(session, 'checkout_session')
  if (session.mode !== 'subscription')
    return false
  const organizationId = session.metadata
    ?.talelabs_organization_id
  const intentId = session.metadata
    ?.talelabs_subscription_checkout_intent_id
  if (!organizationId || !intentId)
    throw new Error('stripe_subscription_checkout_metadata_missing')

  if (input.eventType === 'checkout.session.expired') {
    await database.updateTable('billingSubscriptionCheckoutIntents')
      .set({
        status: 'expired',
        stripeCheckoutSessionId: session.id,
        stripeRequestLeaseExpiresAt: null,
        stripeRequestLeaseToken: null,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', organizationId)
      .where('id', '=', intentId)
      .where('status', '=', 'pending')
      .execute()
    return true
  }

  const subscriptionId = stripeObjectId(session.subscription)
  if (
    input.eventType === 'checkout.session.async_payment_failed'
    && !subscriptionId
  ) {
    await database.updateTable('billingSubscriptionCheckoutIntents')
      .set({
        status: 'failed',
        stripeCheckoutSessionId: session.id,
        stripeRequestLeaseExpiresAt: null,
        stripeRequestLeaseToken: null,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', organizationId)
      .where('id', '=', intentId)
      .where('status', '=', 'pending')
      .execute()
    return true
  }
  if (!subscriptionId)
    throw new Error('stripe_subscription_checkout_subscription_missing')

  // Legacy delayed-payment Sessions can retain an active Subscription after
  // payment failure. Project current Stripe state so it durably blocks another
  // Checkout until Stripe reports explicit recovery or cancellation.
  await projectStripeSubscription(subscriptionId, database, stripe)
  await database.updateTable('billingSubscriptionCheckoutIntents')
    .set({
      completedAt: new Date(),
      status: 'completed',
      stripeCheckoutSessionId: session.id,
      stripeRequestLeaseExpiresAt: null,
      stripeRequestLeaseToken: null,
      stripeSubscriptionId: subscriptionId,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', organizationId)
    .where('id', '=', intentId)
    .where('status', 'in', ['pending', 'completed'])
    .execute()
  return true
}

/** Dispatches one Checkout event only after retrieving the current Session. */
export async function processStripeCheckoutSession(input: {
  /** Signed Stripe event type. */
  eventType: CheckoutTerminalEvent
  /** Current Checkout Session identity. */
  stripeCheckoutSessionId: string
}, database: DatabaseExecutor = db, stripe: StripeClient = stripeClient) {
  const session = await stripe.checkout.sessions.retrieve(
    input.stripeCheckoutSessionId,
  )
  assertStripeTestResource(session, 'checkout_session')
  if (session.metadata?.talelabs_billing_verifier)
    return false
  if (session.mode === 'subscription')
    return projectSubscriptionCheckout(input, database, stripe)
  if (
    input.eventType === 'checkout.session.completed'
    || input.eventType === 'checkout.session.async_payment_succeeded'
  ) {
    return fulfillPaidTopUpCheckout(session.id, database, stripe)
  }
  return failTopUpCheckout({
    status: input.eventType === 'checkout.session.expired'
      ? 'expired'
      : 'failed',
    stripeCheckoutSessionId: session.id,
  }, database, stripe)
}
