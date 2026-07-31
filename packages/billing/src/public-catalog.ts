/** Sanitized customer catalog projection without private economics or Stripe IDs. */

import type { BillingPlanCode } from './contracts.js'

import { BILLING_CATALOG } from './catalog.js'
import { generateTopUpQuotes, quoteTopUp } from './top-ups.js'

/** Builds the public catalog for an organization's current pricing entitlement. */
export function createPublicBillingCatalog(input: {
  /** Current organization plan used for top-up pricing. */
  planCode: BillingPlanCode
  /** Current recurring option used for paid top-up pricing. */
  recurringOptionCode: null | string
}) {
  return {
    revision: BILLING_CATALOG.revision,
    currency: BILLING_CATALOG.currency,
    plans: (Object.entries(BILLING_CATALOG.plans) as [
      BillingPlanCode,
      (typeof BILLING_CATALOG.plans)[BillingPlanCode],
    ][]).map(([code, plan]) => ({
      code,
      browserByok: plan.browserByok,
      defaultRecurringOptionCode: plan.defaultRecurringOptionCode,
      storageBytes: plan.storageBytes,
      recurringOptions: plan.currentRecurringOptions.map((option) => {
        const maximumTopUp = quoteTopUp({
          amountUsdCents: BILLING_CATALOG.topUps.maxAmountUsdCents,
          planCode: code,
          recurringOptionCode: option.code,
        })
        return {
          code: option.code,
          maximumTopUpCredits: maximumTopUp.credits,
          maximumTopUpRateImprovementBpsFromFree:
            maximumTopUp.planRateImprovementBpsFromFree,
          maximumTopUpSavingsBps:
            maximumTopUp.volumeRateImprovementBps,
          monthlyCredits: option.monthlyCredits,
          offers: (['month', 'year'] as const).map(billingInterval => ({
            billingInterval,
            offerCode: option[billingInterval].offerCode,
            priceUsdCents: option[billingInterval].priceUsdCents,
          })),
        }
      }),
    })),
    programs: {
      founder: {
        oneTimeCredits: BILLING_CATALOG.programs.founder.oneTimeCredits,
        underlyingPlanCode:
          BILLING_CATALOG.programs.founder.underlyingPlanCode,
      },
    },
    topUps: {
      packageAmountsUsdCents: [
        ...BILLING_CATALOG.topUps.packageAmountsUsdCents,
      ],
      minAmountUsdCents: BILLING_CATALOG.topUps.minAmountUsdCents,
      maxAmountUsdCents: BILLING_CATALOG.topUps.maxAmountUsdCents,
      stepUsdCents: BILLING_CATALOG.topUps.stepUsdCents,
      expires: BILLING_CATALOG.topUps.expires,
      increasesStorage: false as const,
      quotes: generateTopUpQuotes(input),
    },
  }
}
