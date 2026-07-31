/** Exact contribution-margin calculations for recurring offers and top-ups. */

import type {
  BillingInterval,
  BillingPlanCode,
  BillingRecurringOption,
} from './contracts.js'

import { BILLING_CATALOG } from './catalog.js'
import {
  addRational,
  divideRational,
  floorRational,
  multiplyRational,
  rational,
  rationalFromDecimal,
  safeInteger,
  subtractRational,
} from './exact.js'

const BASIS_POINTS = rational(10_000)
const CENTS_PER_USD = rational(100)

function percentageCost(revenueUsd: ReturnType<typeof rational>) {
  const policy = BILLING_CATALOG.contributionModel
  const totalBps = policy.grossRevenueTaxBps
    + policy.paymentAndFxReserveBps
    + policy.billingAndRefundRiskBps
    + policy.runtimeReserveBps
  return multiplyRational(revenueUsd, rational(totalBps, 10_000))
}

function providerCostCeilingUsd(credits: number) {
  return multiplyRational(
    rational(credits),
    rationalFromDecimal(
      BILLING_CATALOG.creditPolicy.providerCostAllowanceUsdPerCredit,
    ),
  )
}

function marginBps(revenueUsd: ReturnType<typeof rational>, costUsd: ReturnType<typeof rational>) {
  const retained = subtractRational(revenueUsd, costUsd)
  return safeInteger(floorRational(multiplyRational(
    divideRational(retained, revenueUsd),
    BASIS_POINTS,
  )))
}

/** Calculates the conservative full-use contribution margin of a paid offer. */
export function recurringOfferContributionMarginBps(input: {
  /** Monthly or annual customer cadence. */
  billingInterval: BillingInterval
  /** Paid plan identity owning the option. */
  planCode: 'creator' | 'pro'
  /** Reviewed recurring option. */
  recurringOption: BillingRecurringOption
}) {
  const offer = input.recurringOption[input.billingInterval]
  const monthlyRevenueUsd = divideRational(
    rational(offer.priceUsdCents),
    input.billingInterval === 'year'
      ? rational(1_200)
      : CENTS_PER_USD,
  )
  const policy = BILLING_CATALOG.contributionModel
  const fixedUsd = divideRational(
    rational(
      policy.paymentFixedUsdCents
      + policy.fixedInfrastructureUsdCentsPerPaidOrganizationMonth
      + policy.monthlyStorageAllocationUsdCents[input.planCode],
    ),
    CENTS_PER_USD,
  )
  const totalCost = addRational(
    addRational(
      percentageCost(monthlyRevenueUsd),
      providerCostCeilingUsd(input.recurringOption.monthlyCredits),
    ),
    fixedUsd,
  )
  return marginBps(monthlyRevenueUsd, totalCost)
}

/** Calculates the conservative full-use contribution margin of a top-up. */
export function topUpContributionMarginBps(
  amountUsdCents: number,
  credits: number,
) {
  const revenueUsd = divideRational(rational(amountUsdCents), CENTS_PER_USD)
  const fixedUsd = divideRational(
    rational(
      BILLING_CATALOG.contributionModel.paymentFixedUsdCents
      + BILLING_CATALOG.topUps.platformAllocationUsdCents,
    ),
    CENTS_PER_USD,
  )
  const totalCost = addRational(
    addRational(percentageCost(revenueUsd), providerCostCeilingUsd(credits)),
    fixedUsd,
  )
  return marginBps(revenueUsd, totalCost)
}

/** Lists every current paid recurring offer with its modeled margin. */
export function currentRecurringOfferMargins() {
  return (['creator', 'pro'] as const).flatMap(planCode =>
    BILLING_CATALOG.plans[planCode].currentRecurringOptions.flatMap(
      recurringOption => (['month', 'year'] as const).map(
        billingInterval => ({
          billingInterval,
          marginBps: recurringOfferContributionMarginBps({
            billingInterval,
            planCode,
            recurringOption,
          }),
          offerCode: recurringOption[billingInterval].offerCode,
          planCode: planCode as BillingPlanCode,
          recurringOptionCode: recurringOption.code,
        }),
      ),
    ),
  )
}
