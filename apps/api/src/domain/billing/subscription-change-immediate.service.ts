/** Payment-gated Stripe application for immediate paid subscription changes. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { Stripe, StripeClient } from '@talelabs/stripe'
import type {
  admitSubscriptionChangeIntent,
} from './subscription-change-intent.service.js'

import { applyPaidSubscriptionChange } from '@talelabs/db'
import {
  resolvePaidInvoicePaymentIntentId,
  resolvePaidSubscriptionChangeFacts,
} from '@talelabs/stripe'

import {
  attachSubscriptionChangeInvoice,
  releaseSubscriptionChangeIntentLease,
} from './subscription-change-intent.service.js'

function toUnixSeconds(value: Date) {
  return Math.floor(value.getTime() / 1_000)
}

function fromUnixSeconds(value: number) {
  return new Date(value * 1_000)
}

async function latestInvoice(
  subscription: Stripe.Subscription,
  stripe: StripeClient,
) {
  const invoice = subscription.latest_invoice
  if (!invoice)
    throw new Error('stripe_subscription_change_invoice_missing')
  return typeof invoice === 'string'
    ? stripe.invoices.retrieve(invoice, { expand: ['payments'] })
    : invoice
}

/**
 * Applies one admitted immediate change or returns the Stripe-hosted recovery
 * URL while payment remains incomplete.
 */
export async function applyImmediateSubscriptionChange(
  admitted: Awaited<ReturnType<typeof admitSubscriptionChangeIntent>> & {
    currentPrice: Stripe.Price
    item: Stripe.SubscriptionItem
    nextPrice: Stripe.Price
  },
  stripe: StripeClient,
  database: DatabaseExecutor,
) {
  if (!admitted.leaseToken || !admitted.intent.prorationDate)
    throw new Error('subscription_change_intent_lease_missing')
  const resetsCadence
    = admitted.local.billingInterval !== admitted.intent.toBillingInterval
  const updated = await stripe.subscriptions.update(
    admitted.local.stripeSubscriptionId,
    {
      ...(!resetsCadence && { billing_cycle_anchor: 'unchanged' as const }),
      expand: ['latest_invoice'],
      items: [
        {
          id: admitted.item.id,
          price: admitted.nextPrice.id,
          quantity: 1,
        },
      ],
      metadata: {
        talelabs_catalog_revision: admitted.next.offer.catalogRevision,
        talelabs_offer_code: admitted.next.offer.offerCode,
        talelabs_organization_id: admitted.local.organizationId,
        talelabs_plan_code: admitted.intent.toPlanCode,
        talelabs_recurring_option_code: admitted.next.option.code,
        talelabs_subscription_checkout_intent_id: '',
        talelabs_subscription_change_intent_id: admitted.intent.id,
      },
      payment_behavior: 'pending_if_incomplete',
      proration_behavior: 'always_invoice',
      proration_date: toUnixSeconds(admitted.intent.prorationDate),
    },
    {
      idempotencyKey:
        `talelabs:subscription-change:${admitted.intent.id}:apply`,
    },
  )
  const invoice = await latestInvoice(updated, stripe)
  await attachSubscriptionChangeInvoice(
    {
      intentId: admitted.intent.id,
      leaseToken: admitted.leaseToken,
      organizationId: admitted.local.organizationId,
      stripeInvoiceId: invoice.id,
    },
    database,
  )
  if (invoice.status !== 'paid') {
    await releaseSubscriptionChangeIntentLease(
      {
        intentId: admitted.intent.id,
        leaseToken: admitted.leaseToken,
        organizationId: admitted.local.organizationId,
      },
      database,
    )
    return {
      creditsAdded: 0,
      paymentUrl: invoice.hosted_invoice_url ?? null,
      status: 'payment_required' as const,
    }
  }
  const facts = await resolvePaidSubscriptionChangeFacts(
    invoice,
    updated,
    {
      billingInterval: admitted.intent.toBillingInterval,
      catalogRevision: admitted.next.offer.catalogRevision,
      expectedAmountDueMinor: admitted.intent.expectedAmountDueMinor!,
      intentId: admitted.intent.id,
      monthlyCredits: admitted.next.option.monthlyCredits,
      offerCode: admitted.next.offer.offerCode,
      organizationId: admitted.local.organizationId,
      planCode: admitted.intent.toPlanCode,
      recurringOptionCode: admitted.next.option.code,
      stripePriceId: admitted.nextPrice.id,
      stripeSubscriptionId: admitted.local.stripeSubscriptionId,
    },
    stripe,
  )
  const result = await applyPaidSubscriptionChange(
    {
      ...facts,
      intentId: admitted.intent.id,
      organizationId: admitted.local.organizationId,
      paidAt: fromUnixSeconds(
        invoice.status_transitions.paid_at ?? invoice.created,
      ),
      stripePaymentIntentId: await resolvePaidInvoicePaymentIntentId(
        invoice,
        stripe,
      ),
    },
    database,
  )
  return {
    creditsAdded: result.replayed
      ? admitted.intent.creditAdjustment
      : result.creditGrant,
    paymentUrl: null,
    status: 'applied' as const,
  }
}
