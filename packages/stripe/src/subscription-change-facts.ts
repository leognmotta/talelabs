/** Stripe-side validation for one paid, payment-gated subscription change. */

import type { BillingCatalog } from '@talelabs/billing'
import type { Stripe, StripeClient } from './client.js'

import {
  BILLING_CATALOG,
  findBillingOfferByStripeLookupKey,
} from '@talelabs/billing'

/** Code-owned target facts captured by a durable subscription-change intent. */
export interface PaidSubscriptionChangeTarget {
  /** Catalog revision authorizing the target. */
  catalogRevision: string
  /** Previewed amount due immediately in USD cents. */
  expectedAmountDueMinor: number
  /** Durable local change identity embedded in Stripe metadata. */
  intentId: string
  /** Tenant owning the subscription. */
  organizationId: string
  /** Immutable target offer identity. */
  offerCode: string
  /** Target paid plan. */
  planCode: 'creator' | 'pro'
  /** Target monthly allowance. */
  monthlyCredits: number
  /** Target recurring option. */
  recurringOptionCode: string
  /** Exact target Stripe Price. */
  stripePriceId: string
  /** Exact Stripe Subscription. */
  stripeSubscriptionId: string
  /** Target monthly or annual cadence. */
  billingInterval: 'month' | 'year'
}

/** Immutable facts proven by a paid Stripe subscription-update Invoice. */
export interface PaidSubscriptionChangeFacts {
  /** Exact amount collected in USD cents. */
  amountPaidMinor: number
  /** Paid Invoice identity. */
  stripeInvoiceId: string
  /** Positive target-price Invoice Line identity. */
  stripeInvoiceLineItemId: string
  /** Inclusive target-price service boundary. */
  servicePeriodStart: Date
  /** Exclusive target-price service boundary. */
  servicePeriodEnd: Date
  /** Current Stripe item period start after the applied update. */
  targetPeriodStart: Date
  /** Current Stripe item period end after the applied update. */
  targetPeriodEnd: Date
}

function fromUnixSeconds(value: number) {
  return new Date(value * 1_000)
}

function objectId(value: null | string | { id: string } | undefined) {
  return typeof value === 'string' ? value : value?.id ?? null
}

/** Resolves the successful PaymentIntent attached to one paid Invoice. */
export async function resolvePaidInvoicePaymentIntentId(
  invoice: Stripe.Invoice,
  stripe: StripeClient,
) {
  const payments = invoice.payments?.data
    ?? (
      await stripe.invoicePayments.list({
        invoice: invoice.id,
        limit: 10,
        status: 'paid',
      })
    ).data
  const paid = payments.find(payment => payment.status === 'paid')
  return objectId(paid?.payment.payment_intent)
}

/**
 * Validates the paid Invoice, exact target Price, metadata, and current Stripe
 * Subscription before TaleLabs may apply the local entitlement change.
 */
export async function resolvePaidSubscriptionChangeFacts(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  target: PaidSubscriptionChangeTarget,
  stripe: StripeClient,
  catalog: BillingCatalog = BILLING_CATALOG,
): Promise<PaidSubscriptionChangeFacts> {
  const parent = invoice.parent?.type === 'subscription_details'
    ? invoice.parent.subscription_details
    : null
  const metadata = parent?.metadata
  const item = subscription.items.data[0]
  if (
    invoice.livemode
    || subscription.livemode
    || invoice.status !== 'paid'
    || invoice.billing_reason !== 'subscription_update'
    || invoice.currency !== catalog.currency
    || invoice.amount_due !== target.expectedAmountDueMinor
    || invoice.amount_paid !== target.expectedAmountDueMinor
    || objectId(parent?.subscription) !== target.stripeSubscriptionId
    || metadata?.talelabs_subscription_change_intent_id !== target.intentId
    || metadata?.talelabs_organization_id !== target.organizationId
    || subscription.id !== target.stripeSubscriptionId
    || subscription.metadata.talelabs_subscription_change_intent_id
    !== target.intentId
    || subscription.metadata.talelabs_organization_id !== target.organizationId
    || subscription.items.data.length !== 1
    || !item
    || item.price.id !== target.stripePriceId
  ) {
    throw new Error('stripe_subscription_change_payment_mismatch')
  }

  const price = item.price
  const resolved = price.lookup_key
    ? findBillingOfferByStripeLookupKey(price.lookup_key, catalog)
    : null
  if (
    !resolved
    || resolved.planCode !== target.planCode
    || resolved.recurringOptionCode !== target.recurringOptionCode
    || resolved.monthlyCredits !== target.monthlyCredits
    || resolved.billingInterval !== target.billingInterval
    || resolved.offer.offerCode !== target.offerCode
    || resolved.offer.catalogRevision !== target.catalogRevision
    || price.currency !== catalog.currency
    || price.unit_amount !== resolved.offer.priceUsdCents
    || price.recurring?.interval !== target.billingInterval
  ) {
    throw new Error('stripe_subscription_change_price_mismatch')
  }

  const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 100 })
  if (lines.has_more)
    throw new Error('stripe_invoice_lines_unbounded')
  const targetLines = lines.data.filter((line) => {
    const details = line.parent?.type === 'subscription_item_details'
      ? line.parent.subscription_item_details
      : null
    return !line.livemode
      && details?.subscription === target.stripeSubscriptionId
      && objectId(line.pricing?.price_details?.price) === target.stripePriceId
      && line.amount > 0
  })
  if (targetLines.length !== 1)
    throw new Error('stripe_subscription_change_line_invalid')
  const targetLine = targetLines[0]!
  if (
    targetLine.invoice !== invoice.id
    || targetLine.currency !== catalog.currency
    || targetLine.quantity !== 1
    || targetLine.period.end <= targetLine.period.start
  ) {
    throw new Error('stripe_subscription_change_line_mismatch')
  }
  return {
    amountPaidMinor: invoice.amount_paid,
    servicePeriodEnd: fromUnixSeconds(targetLine.period.end),
    servicePeriodStart: fromUnixSeconds(targetLine.period.start),
    stripeInvoiceId: invoice.id,
    stripeInvoiceLineItemId: targetLine.id,
    targetPeriodEnd: fromUnixSeconds(item.current_period_end),
    targetPeriodStart: fromUnixSeconds(item.current_period_start),
  }
}
