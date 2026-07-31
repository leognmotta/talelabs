/** Immutable paid-Invoice line facts used to authorize subscription grants. */

import type { BillingCatalog } from '@talelabs/billing'
import type { Stripe, StripeClient } from '@talelabs/stripe'

import {
  BILLING_CATALOG,
  findBillingOfferByStripeLookupKey,
} from '@talelabs/billing'

import {
  assertStripeTestResource,
  stripeObjectId,
} from './stripe-facts.js'

interface PaidInvoiceGrantFacts {
  amountPaidMinor: number
  servicePeriodEnd: Date
  servicePeriodStart: Date
  stripeInvoiceLineItemId: string
  stripePriceId: string
  subscriptionBillingInterval: 'month' | 'year'
  subscriptionCatalogRevision: string
  subscriptionMonthlyCredits: number
  subscriptionOfferCode: string
  subscriptionPlanCode: 'creator' | 'pro'
  subscriptionRecurringOptionCode: string
}

function fromUnixSeconds(value: number) {
  return new Date(value * 1_000)
}

/**
 * Resolves the exact non-proration Invoice line and validates its immutable
 * current-or-historical recurring offer before any payment can authorize grants.
 */
export async function resolvePaidInvoiceGrantFacts(
  invoice: Stripe.Invoice,
  stripeSubscriptionId: string,
  stripe: StripeClient,
  catalog: BillingCatalog = BILLING_CATALOG,
): Promise<PaidInvoiceGrantFacts> {
  const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 100 })
  if (lines.has_more)
    throw new Error('stripe_invoice_lines_unbounded')
  const matchingLines = lines.data.filter((line) => {
    const details
      = line.parent?.type === 'subscription_item_details'
        ? line.parent.subscription_item_details
        : null
    return details?.subscription === stripeSubscriptionId && !details.proration
  })
  if (matchingLines.length !== 1)
    throw new Error('stripe_invoice_subscription_line_invalid')
  const line = matchingLines[0]!
  assertStripeTestResource(line, 'invoice_line_item')
  const priceReference = line.pricing?.price_details?.price
  const stripePriceId = stripeObjectId(priceReference)
  if (!stripePriceId)
    throw new Error('stripe_invoice_price_missing')
  const price
    = typeof priceReference === 'object'
      ? priceReference
      : await stripe.prices.retrieve(stripePriceId)
  assertStripeTestResource(price, 'price')
  const resolved = price.lookup_key
    ? findBillingOfferByStripeLookupKey(price.lookup_key, catalog)
    : null
  if (
    !resolved
    || line.invoice !== invoice.id
    || line.quantity !== 1
    || line.currency !== invoice.currency
    || line.currency !== catalog.currency
    || line.amount !== resolved.offer.priceUsdCents
    || invoice.amount_paid !== line.amount
    || price.id !== stripePriceId
    || price.currency !== line.currency
    || price.unit_amount !== resolved.offer.priceUsdCents
    || price.recurring?.interval !== resolved.billingInterval
    || price.metadata.talelabs_catalog_revision
    !== resolved.offer.catalogRevision
    || price.metadata.talelabs_offer_code !== resolved.offer.offerCode
    || price.metadata.talelabs_plan_code !== resolved.planCode
    || price.metadata.talelabs_recurring_option_code
    !== resolved.recurringOptionCode
    || price.metadata.talelabs_monthly_credits
    !== String(resolved.monthlyCredits)
    || line.period.end <= line.period.start
  ) {
    throw new Error('stripe_invoice_line_catalog_mismatch')
  }
  return {
    amountPaidMinor: line.amount,
    servicePeriodEnd: fromUnixSeconds(line.period.end),
    servicePeriodStart: fromUnixSeconds(line.period.start),
    stripeInvoiceLineItemId: line.id,
    stripePriceId,
    subscriptionBillingInterval: resolved.billingInterval,
    subscriptionCatalogRevision: resolved.offer.catalogRevision,
    subscriptionMonthlyCredits: resolved.monthlyCredits,
    subscriptionOfferCode: resolved.offer.offerCode,
    subscriptionPlanCode: resolved.planCode,
    subscriptionRecurringOptionCode: resolved.recurringOptionCode,
  }
}
