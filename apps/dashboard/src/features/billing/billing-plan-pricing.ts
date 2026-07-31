/** Shared public-catalog pricing helpers for Billing plan presentation. */

import type { BillingCatalogResponse } from '@talelabs/sdk'

/** One public plan returned by the code-owned Billing catalog. */
export type CatalogPlan = BillingCatalogResponse['plans'][number]

/** One selectable recurring allowance within a public Billing plan. */
export type RecurringOption = CatalogPlan['recurringOptions'][number]

function safeBillingNumber(value: bigint) {
  const numberValue = Number(value)
  if (!Number.isSafeInteger(numberValue))
    throw new RangeError('Billing presentation value exceeds the safe range.')
  return numberValue
}

/** Resolves the catalog offer for one recurring option and billing cadence. */
export function findBillingOffer(
  option: RecurringOption,
  interval: 'month' | 'year',
) {
  const offer = option.offers.find(
    candidate => candidate.billingInterval === interval,
  )
  if (!offer)
    throw new Error('billing_catalog_offer_missing')
  return offer
}

/** Derives exact annual savings and a rounded monthly equivalent in cents. */
export function getAnnualPricePresentation(option: RecurringOption) {
  const monthlyOffer = findBillingOffer(option, 'month')
  const annualOffer = findBillingOffer(option, 'year')
  const annualPrice = BigInt(annualOffer.priceUsdCents)
  const annualSavings = BigInt(monthlyOffer.priceUsdCents) * 12n - annualPrice
  return {
    annualSavingsUsdCents: safeBillingNumber(
      annualSavings > 0n ? annualSavings : 0n,
    ),
    monthlyEquivalentUsdCents: safeBillingNumber(
      (annualPrice + 6n) / 12n,
    ),
  }
}
