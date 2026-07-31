/** Code-owned TaleLabs plans, immutable offers, and launch economics. */

import type {
  BillingCatalog,
  BillingOffer,
  BillingPlanCode,
} from './contracts.js'

/** Current immutable billing catalog revision. */
export const BILLING_CATALOG_REVISION = '2026-07-27.5'

/** Complete server-only TaleLabs launch billing catalog. */
export const BILLING_CATALOG = {
  revision: BILLING_CATALOG_REVISION,
  currency: 'usd',
  creditPolicy: {
    providerCostAllowanceUsdPerCredit: '0.0045',
    minimumFullUseContributionMarginBps: 2_000,
    landedCostByProvider: {
      openrouter: {
        purchaseFeeMultiplier: '1.055',
        contingencyMultiplier: '1.05',
      },
      fal: {
        purchaseFeeMultiplier: '1',
        contingencyMultiplier: '1.05',
      },
    },
  },
  contributionModel: {
    grossRevenueTaxBps: 1_100,
    paymentAndFxReserveBps: 750,
    paymentFixedUsdCents: 10,
    billingAndRefundRiskBps: 150,
    runtimeReserveBps: 100,
    fixedInfrastructureUsdCentsPerPaidOrganizationMonth: 150,
    monthlyStorageAllocationUsdCents: {
      creator: 18,
      pro: 90,
    },
  },
  programs: {
    founder: {
      underlyingPlanCode: 'free',
      oneTimeCredits: 150,
      outputVisibility: 'public',
      showcaseEligible: true,
    },
  },
  topUps: {
    enabledPlanCodes: ['free', 'creator', 'pro'],
    packageAmountsUsdCents: [1_000, 5_000, 10_000, 25_000, 39_000],
    minAmountUsdCents: 1_000,
    maxAmountUsdCents: 39_000,
    stepUsdCents: 500,
    creditsAtMinimumAmountByPlanCode: {
      free: 343,
      creator: 514,
      pro: 686,
    },
    freeCreditsAtMaximumAmount: 22_295,
    creditsAtMaximumAmountByRecurringOptionCode: {
      'creator-1600': 34_666,
      'pro-5300': 35_672,
      'pro-11300': 38_220,
      'pro-17300': 40_536,
      'pro-29500': 46_204,
    },
    platformAllocationUsdCents: 150,
    outputVisibility: 'private',
    showcaseEligible: false,
    expires: false,
  },
  plans: {
    free: {
      storageBytes: 100 * 1024 * 1024,
      browserByok: true,
      defaultRecurringOptionCode: null,
      currentRecurringOptions: [],
      historicalOffers: [],
    },
    creator: {
      storageBytes: 10 * 1024 * 1024 * 1024,
      browserByok: true,
      defaultRecurringOptionCode: 'creator-1600',
      currentRecurringOptions: [
        {
          code: 'creator-1600',
          monthlyCredits: 1_600,
          month: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'creator-monthly-1600-2026-07',
            priceUsdCents: 1_800,
            stripeLookupKey: 'talelabs_creator_monthly_1600_2026_07',
          },
          year: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'creator-annual-1600-2026-07',
            priceUsdCents: 19_200,
            stripeLookupKey: 'talelabs_creator_annual_1600_2026_07',
          },
        },
      ],
      historicalOffers: [],
    },
    pro: {
      storageBytes: 50 * 1024 * 1024 * 1024,
      browserByok: true,
      defaultRecurringOptionCode: 'pro-5300',
      currentRecurringOptions: [
        {
          code: 'pro-5300',
          monthlyCredits: 5_300,
          month: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-monthly-5300-2026-07',
            priceUsdCents: 4_900,
            stripeLookupKey: 'talelabs_pro_monthly_5300_2026_07',
          },
          year: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-annual-5300-2026-07',
            priceUsdCents: 54_800,
            stripeLookupKey: 'talelabs_pro_annual_5300_2026_07',
          },
        },
        {
          code: 'pro-11300',
          monthlyCredits: 11_300,
          month: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-monthly-11300-2026-07',
            priceUsdCents: 9_900,
            stripeLookupKey: 'talelabs_pro_monthly_11300_2026_07',
          },
          year: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-annual-11300-2026-07',
            priceUsdCents: 110_400,
            stripeLookupKey: 'talelabs_pro_annual_11300_2026_07',
          },
        },
        {
          code: 'pro-17300',
          monthlyCredits: 17_300,
          month: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-monthly-17300-2026-07',
            priceUsdCents: 14_900,
            stripeLookupKey: 'talelabs_pro_monthly_17300_2026_07',
          },
          year: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-annual-17300-2026-07',
            priceUsdCents: 166_800,
            stripeLookupKey: 'talelabs_pro_annual_17300_2026_07',
          },
        },
        {
          code: 'pro-29500',
          monthlyCredits: 29_500,
          month: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-monthly-29500-2026-07',
            priceUsdCents: 24_900,
            stripeLookupKey: 'talelabs_pro_monthly_29500_2026_07',
          },
          year: {
            catalogRevision: '2026-07-27.5',
            offerCode: 'pro-annual-29500-2026-07',
            priceUsdCents: 279_000,
            stripeLookupKey: 'talelabs_pro_annual_29500_2026_07',
          },
        },
      ],
      historicalOffers: [],
    },
  },
} as const satisfies BillingCatalog

/** Resolves one current plan or throws for an unsupported code. */
export function getBillingPlan(planCode: keyof typeof BILLING_CATALOG.plans) {
  return BILLING_CATALOG.plans[planCode]
}

/** Resolves one current recurring option within its exact plan. */
export function getBillingRecurringOption(
  planCode: 'creator' | 'pro',
  recurringOptionCode: string,
) {
  return BILLING_CATALOG.plans[planCode].currentRecurringOptions.find(
    option => option.code === recurringOptionCode,
  ) ?? null
}

/** Resolves one current immutable recurring offer. */
export function getBillingOffer(input: {
  billingInterval: 'month' | 'year'
  planCode: 'creator' | 'pro'
  recurringOptionCode: string
}) {
  const option = getBillingRecurringOption(
    input.planCode,
    input.recurringOptionCode,
  )
  return option ? { offer: option[input.billingInterval], option } : null
}

/** Normalized current-or-historical recurring offer used for Stripe projection. */
export interface ResolvedBillingRecurringOffer {
  /** Stripe billing cadence represented by the immutable offer. */
  billingInterval: 'month' | 'year'
  /** Whether new Checkout sessions may select this offer. */
  currentForCheckout: boolean
  /** Credits released for each eligible internal monthly grant period. */
  monthlyCredits: number
  /** Immutable commercial offer facts. */
  offer: BillingOffer
  /** Paid plan that owns the offer. */
  planCode: Exclude<BillingPlanCode, 'free'>
  /** Stable recurring allowance identity represented by the offer. */
  recurringOptionCode: string
}

/**
 * Resolves one current or historical recurring offer from its private immutable
 * Stripe lookup key. Historical offers remain executable but never selectable
 * by new Checkout sessions.
 */
export function findBillingOfferByStripeLookupKey(
  stripeLookupKey: string,
  catalog: BillingCatalog = BILLING_CATALOG,
): ResolvedBillingRecurringOffer | null {
  for (const planCode of ['creator', 'pro'] as const) {
    const plan = catalog.plans[planCode]
    for (const option of plan.currentRecurringOptions) {
      for (const billingInterval of ['month', 'year'] as const) {
        const offer = option[billingInterval]
        if (offer.stripeLookupKey === stripeLookupKey) {
          return {
            billingInterval,
            currentForCheckout: true,
            monthlyCredits: option.monthlyCredits,
            offer,
            planCode,
            recurringOptionCode: option.code,
          }
        }
      }
    }
    const historicalOffer = plan.historicalOffers.find(
      offer => offer.stripeLookupKey === stripeLookupKey,
    )
    if (historicalOffer) {
      return {
        billingInterval: historicalOffer.billingInterval,
        currentForCheckout: false,
        monthlyCredits: historicalOffer.monthlyCredits,
        offer: historicalOffer,
        planCode,
        recurringOptionCode: historicalOffer.recurringOptionCode,
      }
    }
  }
  return null
}
