/** Exact entitlement-specific top-up curve generation and validation. */

import type {
  BillingPlanCode,
  BillingRecurringOption,
  TopUpPurchaseQuote,
  TopUpQuote,
} from './contracts.js'

import { BILLING_CATALOG, getBillingRecurringOption } from './catalog.js'
import { topUpContributionMarginBps } from './economics.js'
import {
  addRational,
  compareRational,
  divideRational,
  floorRational,
  multiplyRational,
  rational,
  rationalToDecimal,
  safeInteger,
  subtractRational,
} from './exact.js'

function assertTopUpAmount(amountUsdCents: number) {
  const policy = BILLING_CATALOG.topUps
  if (
    !Number.isSafeInteger(amountUsdCents)
    || amountUsdCents < policy.minAmountUsdCents
    || amountUsdCents > policy.maxAmountUsdCents
    || (amountUsdCents - policy.minAmountUsdCents) % policy.stepUsdCents !== 0
  ) {
    throw new RangeError('invalid_topup_amount')
  }
}

function resolvePaidOption(
  planCode: BillingPlanCode,
  recurringOptionCode: null | string,
): BillingRecurringOption | null {
  if (planCode === 'free') {
    if (recurringOptionCode !== null)
      throw new RangeError('Free top-ups cannot use a recurring option.')
    return null
  }
  if (!recurringOptionCode)
    throw new RangeError('Paid top-ups require the active recurring option.')
  const option = getBillingRecurringOption(planCode, recurringOptionCode)
  if (!option)
    throw new RangeError('The recurring option is not current.')
  return option
}

function maximumCredits(
  planCode: BillingPlanCode,
  option: BillingRecurringOption | null,
) {
  if (planCode === 'free')
    return BILLING_CATALOG.topUps.freeCreditsAtMaximumAmount
  if (!option)
    throw new TypeError('A paid top-up is missing its recurring option.')
  const reviewedEndpoints: Readonly<Record<string, number>>
    = BILLING_CATALOG.topUps.creditsAtMaximumAmountByRecurringOptionCode
  const credits = reviewedEndpoints[option.code]
  if (!credits)
    throw new RangeError('The recurring option has no reviewed top-up endpoint.')
  return credits
}

function interpolatePricePerCredit(input: {
  amountUsdCents: number
  creditsAtMaximum: number
  creditsAtMinimum: number
}) {
  const policy = BILLING_CATALOG.topUps
  const progress = rational(
    input.amountUsdCents - policy.minAmountUsdCents,
    policy.maxAmountUsdCents - policy.minAmountUsdCents,
  )
  const minimumRate = rational(
    policy.minAmountUsdCents,
    input.creditsAtMinimum,
  )
  const maximumRate = rational(
    policy.maxAmountUsdCents,
    input.creditsAtMaximum,
  )
  return {
    effectiveRate: addRational(
      minimumRate,
      multiplyRational(
        subtractRational(maximumRate, minimumRate),
        progress,
      ),
    ),
    minimumRate,
  }
}

function rateImprovementBps(
  baseline: ReturnType<typeof rational>,
  current: ReturnType<typeof rational>,
) {
  if (compareRational(current, baseline) >= 0)
    return 0
  return safeInteger(floorRational(multiplyRational(
    divideRational(subtractRational(baseline, current), baseline),
    rational(10_000),
  )))
}

function quoteTopUpCredits(
  amountUsdCents: number,
  planCode: BillingPlanCode,
  recurringOptionCode: null | string,
) {
  assertTopUpAmount(amountUsdCents)
  const option = resolvePaidOption(planCode, recurringOptionCode)
  const creditsAtMinimum
    = BILLING_CATALOG.topUps.creditsAtMinimumAmountByPlanCode[planCode]
  const { effectiveRate, minimumRate } = interpolatePricePerCredit({
    amountUsdCents,
    creditsAtMaximum: maximumCredits(planCode, option),
    creditsAtMinimum,
  })
  const credits = safeInteger(floorRational(divideRational(
    rational(amountUsdCents),
    effectiveRate,
  )))
  return { credits, minimumRate, option }
}

/** Resolves one exact public top-up quote for the active entitlement. */
export function quoteTopUp(input: {
  /** Exact accepted amount in USD cents. */
  amountUsdCents: number
  /** Current plan used for pricing. */
  planCode: BillingPlanCode
  /** Current paid option, or null for Free. */
  recurringOptionCode: null | string
}): TopUpPurchaseQuote {
  const resolved = quoteTopUpCredits(
    input.amountUsdCents,
    input.planCode,
    input.recurringOptionCode,
  )
  const free = input.planCode === 'free'
    ? resolved
    : quoteTopUpCredits(input.amountUsdCents, 'free', null)
  const actualRateUsd = rational(
    input.amountUsdCents,
    resolved.credits * 100,
  )
  const freeActualRateUsd = rational(
    input.amountUsdCents,
    free.credits * 100,
  )
  const actualRateCents = rational(input.amountUsdCents, resolved.credits)
  return {
    amountUsdCents: input.amountUsdCents,
    catalogRevision: BILLING_CATALOG.revision,
    credits: resolved.credits,
    effectiveUsdPerCredit: rationalToDecimal(actualRateUsd),
    modeledContributionMarginBps: topUpContributionMarginBps(
      input.amountUsdCents,
      resolved.credits,
    ),
    planRateImprovementBpsFromFree: rateImprovementBps(
      freeActualRateUsd,
      actualRateUsd,
    ),
    pricingPlanCode: input.planCode,
    pricingRecurringOptionCode: resolved.option?.code ?? null,
    volumeRateImprovementBps: rateImprovementBps(
      resolved.minimumRate,
      actualRateCents,
    ),
  }
}

/** Generates all valid slider points for the active entitlement. */
export function generateTopUpQuotes(input: {
  /** Current plan used for pricing. */
  planCode: BillingPlanCode
  /** Current paid option, or null for Free. */
  recurringOptionCode: null | string
}): TopUpQuote[] {
  const quotes: TopUpQuote[] = []
  for (
    let amountUsdCents = BILLING_CATALOG.topUps.minAmountUsdCents;
    amountUsdCents <= BILLING_CATALOG.topUps.maxAmountUsdCents;
    amountUsdCents += BILLING_CATALOG.topUps.stepUsdCents
  ) {
    const {
      catalogRevision: _catalogRevision,
      modeledContributionMarginBps: _margin,
      ...quote
    } = quoteTopUp({
      amountUsdCents,
      planCode: input.planCode,
      recurringOptionCode: input.recurringOptionCode,
    })
    quotes.push(quote)
  }
  return quotes
}
