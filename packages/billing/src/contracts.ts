/** Stable commercial contracts owned by the TaleLabs billing catalog. */

/** Launch plan identities. Founder is a status on Free, not a plan. */
export type BillingPlanCode = 'creator' | 'free' | 'pro'

/** Supported recurring billing intervals. */
export type BillingInterval = 'month' | 'year'

/** Providers with reviewed landed-cost multipliers. */
export type BillableProvider = 'fal' | 'openrouter'

/** Immutable output access policy attached to a credit source. */
export interface BillingOutputPolicy {
  /** Whether generated media is stored in the public or private boundary. */
  outputVisibility: 'private' | 'public'
  /** Whether the output may enter a separately moderated showcase. */
  showcaseEligible: boolean
}

/** One immutable customer-facing recurring offer. */
export interface BillingOffer {
  /** Catalog revision that originally created and owns the Stripe Price. */
  catalogRevision: string
  /** Versioned offer identity retained for historical settlement. */
  offerCode: string
  /** Integer customer price in USD cents. */
  priceUsdCents: number
  /** Stable code used to locate the matching immutable Stripe Price. */
  stripeLookupKey: string
}

/** Complete immutable facts for a recurring offer retired from new Checkout. */
export interface BillingHistoricalRecurringOffer extends BillingOffer {
  /** Stripe billing cadence represented by the retired Price. */
  billingInterval: BillingInterval
  /** Credits released for each eligible internal monthly grant period. */
  monthlyCredits: number
  /** Stable recurring allowance identity used by the retired Price. */
  recurringOptionCode: string
}

/** One reviewed credit allowance within a paid plan. */
export interface BillingRecurringOption {
  /** Stable option identity shared by monthly and annual offers. */
  code: string
  /** Credits released in each eligible internal monthly grant period. */
  monthlyCredits: number
  /** Immutable monthly customer offer. */
  month: BillingOffer
  /** Immutable annual customer offer. */
  year: BillingOffer
}

/** One plan's entitlements and current recurring commercial options. */
export interface BillingPlan {
  /** Whether the plan permits browser-side BYOK execution. */
  browserByok: boolean
  /** Default option for new Checkout, or null when the plan is not recurring. */
  defaultRecurringOptionCode: null | string
  /** Current recurring options selectable by new customers. */
  currentRecurringOptions: readonly BillingRecurringOption[]
  /** Complete historical recurring facts retained for reconciliation only. */
  historicalOffers: readonly BillingHistoricalRecurringOffer[]
  /** Organization-wide Asset storage allowance in bytes. */
  storageBytes: number
}

/** Exact provider-specific landed-cost policy. */
export interface ProviderLandedCostPolicy {
  /** Exact decimal multiplier for provider purchasing fees. */
  purchaseFeeMultiplier: string
  /** Exact decimal multiplier for conservative provider-price movement. */
  contingencyMultiplier: string
}

/** Complete server-only commercial source of truth. */
export interface BillingCatalog {
  /** Immutable catalog revision captured by every quote and purchase. */
  revision: string
  /** Single launch settlement currency. */
  currency: 'usd'
  /** Provider-cost-to-credit policy. */
  creditPolicy: {
    /** Maximum modeled provider USD represented by one credit. */
    providerCostAllowanceUsdPerCredit: string
    /** Absolute contribution floor for current customer offers. */
    minimumFullUseContributionMarginBps: number
    /** Reviewed provider landed-cost multipliers. */
    landedCostByProvider: Record<BillableProvider, ProviderLandedCostPolicy>
  }
  /** Conservative revenue and operating-cost assumptions. */
  contributionModel: {
    /** Reserve applied to gross revenue. */
    grossRevenueTaxBps: number
    /** Payment, international, and foreign-exchange percentage reserve. */
    paymentAndFxReserveBps: number
    /** Fixed payment reserve in USD cents per modeled month or purchase. */
    paymentFixedUsdCents: number
    /** Billing and refund-risk percentage reserve. */
    billingAndRefundRiskBps: number
    /** Runtime and processing percentage reserve. */
    runtimeReserveBps: number
    /** Fixed infrastructure allocation in USD cents per paid organization month. */
    fixedInfrastructureUsdCentsPerPaidOrganizationMonth: number
    /** Plan-specific storage allocation in USD cents per month. */
    monthlyStorageAllocationUsdCents: Record<'creator' | 'pro', number>
  }
  /** Non-recurring commercial programs layered onto plans. */
  programs: {
    /** Founder status and one-time promotional grant policy. */
    founder: BillingOutputPolicy & {
      /** Plan that Founder augments without replacing. */
      underlyingPlanCode: 'free'
      /** Credits emitted by the one-time welcome grant. */
      oneTimeCredits: number
    }
  }
  /** Code-owned top-up range, curve, and output policy. */
  topUps: BillingOutputPolicy & {
    /** Plans permitted to purchase non-expiring managed credits. */
    enabledPlanCodes: readonly BillingPlanCode[]
    /** Reviewed package shortcuts; every value must also be a valid slider amount. */
    packageAmountsUsdCents: readonly number[]
    /** Smallest accepted top-up in USD cents. */
    minAmountUsdCents: number
    /** Largest accepted top-up in USD cents. */
    maxAmountUsdCents: number
    /** Exact accepted increment in USD cents. */
    stepUsdCents: number
    /** Credits at the smallest amount for each plan. */
    creditsAtMinimumAmountByPlanCode: Record<BillingPlanCode, number>
    /** Credits at the largest Free amount. */
    freeCreditsAtMaximumAmount: number
    /** Reviewed largest-amount endpoint keyed by each paid recurring option. */
    creditsAtMaximumAmountByRecurringOptionCode: Readonly<Record<string, number>>
    /** Fixed platform allocation in USD cents per top-up. */
    platformAllocationUsdCents: number
    /** Launch purchased credits never expire. */
    expires: false
  }
  /** Entitlements and recurring offers keyed by the three plan identities. */
  plans: Record<BillingPlanCode, BillingPlan>
}

/** Exact immutable quote for one provider-funded generation job. */
export interface CreditQuote {
  /** Whole credits charged if the job produces a usable output. */
  credits: number
  /** Exact landed provider cost in USD as a decimal string. */
  landedProviderCostUsd: string
  /** Catalog revision defining the provider-cost policy. */
  pricingPolicyVersion: string
}

/** Exact public quote for one valid top-up slider point. */
export interface TopUpQuote {
  /** Exact purchase amount in USD cents. */
  amountUsdCents: number
  /** Whole non-expiring managed-generation credits purchased. */
  credits: number
  /** Actual USD-per-credit rate represented as an exact decimal string. */
  effectiveUsdPerCredit: string
  /** Improvement from this plan's minimum top-up rate in basis points. */
  volumeRateImprovementBps: number
  /** Improvement from the Free quote at the same amount in basis points. */
  planRateImprovementBpsFromFree: number
  /** Plan used to resolve the quote. */
  pricingPlanCode: BillingPlanCode
  /** Paid option used to select the reviewed endpoint, or null for Free. */
  pricingRecurringOptionCode: null | string
}

/** Private economics evidence captured by an admitted top-up purchase. */
export interface TopUpPurchaseQuote extends TopUpQuote {
  /** Modeled full-use contribution margin in basis points. */
  modeledContributionMarginBps: number
  /** Catalog revision that made the quote authoritative. */
  catalogRevision: string
}
