/** Read-only Stripe verification for retired recurring billing offers. */

import type { BillingHistoricalRecurringOffer } from '@talelabs/billing'
import type { Stripe, StripeClient } from './client.js'

/**
 * Verifies one code-owned historical offer against its existing Stripe Price
 * without creating, updating, activating, or deactivating any Stripe resource.
 */
export async function verifyHistoricalStripePrice(
  input: {
    /** Complete immutable historical offer retained by the billing catalog. */
    offer: BillingHistoricalRecurringOffer
    /** Paid plan that owns the retired recurring offer. */
    planCode: 'creator' | 'pro'
    /** Existing stable Stripe Product that owns the retired Price. */
    stripeProductId: string
  },
  stripe: StripeClient,
): Promise<Stripe.Price> {
  const matches = await stripe.prices.list({
    limit: 2,
    lookup_keys: [input.offer.stripeLookupKey],
  })
  if (matches.data.length !== 1) {
    throw new Error(
      matches.data.length
        ? `Duplicate historical Stripe lookup key: ${
          input.offer.stripeLookupKey}`
        : `Historical Stripe Price missing: ${input.offer.stripeLookupKey}`,
    )
  }
  const price = matches.data[0]!
  const productId = typeof price.product === 'string'
    ? price.product
    : price.product.id
  if (
    price.livemode
    || price.currency !== 'usd'
    || price.unit_amount !== input.offer.priceUsdCents
    || price.recurring?.interval !== input.offer.billingInterval
    || productId !== input.stripeProductId
    || price.metadata.talelabs_catalog_revision
    !== input.offer.catalogRevision
    || price.metadata.talelabs_monthly_credits
    !== String(input.offer.monthlyCredits)
    || price.metadata.talelabs_offer_code !== input.offer.offerCode
    || price.metadata.talelabs_plan_code !== input.planCode
    || price.metadata.talelabs_recurring_option_code
    !== input.offer.recurringOptionCode
  ) {
    throw new Error(
      `Historical Stripe Price drift: ${input.offer.stripeLookupKey}`,
    )
  }
  return price
}
