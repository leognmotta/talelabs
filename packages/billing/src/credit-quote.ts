/** Exact provider landed-cost conversion into immutable whole-credit quotes. */

import type { BillableProvider, CreditQuote } from './contracts.js'

import { BILLING_CATALOG } from './catalog.js'
import {
  ceilRational,
  divideRational,
  multiplyRational,
  rationalFromDecimal,
  rationalToDecimal,
  safeInteger,
} from './exact.js'

/** Quotes one authoritative raw provider USD estimate in whole credits. */
export function quoteProviderCredits(input: {
  /** Provider whose reviewed landed-cost multipliers apply. */
  provider: BillableProvider
  /** Exact raw provider cost in USD. */
  rawProviderCostUsd: string
}): CreditQuote {
  const raw = rationalFromDecimal(input.rawProviderCostUsd)
  if (raw.numerator < 0n)
    throw new RangeError('Provider cost cannot be negative.')
  const policy = BILLING_CATALOG.creditPolicy.landedCostByProvider[input.provider]
  const landed = multiplyRational(
    multiplyRational(raw, rationalFromDecimal(policy.purchaseFeeMultiplier)),
    rationalFromDecimal(policy.contingencyMultiplier),
  )
  const credits = ceilRational(divideRational(
    landed,
    rationalFromDecimal(
      BILLING_CATALOG.creditPolicy.providerCostAllowanceUsdPerCredit,
    ),
  ))
  return {
    credits: Math.max(1, safeInteger(credits)),
    landedProviderCostUsd: rationalToDecimal(landed),
    pricingPolicyVersion: BILLING_CATALOG.revision,
  }
}
