/** Fail-closed validation for TaleLabs offers, top-ups, and quote fixtures. */

import type { BillingCatalog, BillingOffer } from '../src/index.js'

import {
  allocateAnnualRevenueUsdCents,
  BILLING_CATALOG,
  currentRecurringOfferMargins,
  dueMonthlyGrantPeriods,
  findBillingOfferByStripeLookupKey,
  generateTopUpQuotes,
  getBillingOffer,
  monthlyGrantBoundary,
  quoteProviderCredits,
  quoteTopUp,
} from '../src/index.js'

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition)
    throw new Error(message)
}

const offerCodes = new Set<string>()
const lookupKeys = new Set<string>()
const recurringOptionCodes = new Set<string>()

function registerOffer(offer: BillingOffer, context: string) {
  invariant(
    offer.catalogRevision.trim().length > 0,
    `${context} catalog revision must not be empty`,
  )
  invariant(
    offer.offerCode.trim().length > 0,
    `${context} offer code must not be empty`,
  )
  invariant(
    Number.isSafeInteger(offer.priceUsdCents) && offer.priceUsdCents > 0,
    `${context} price must be positive integer USD cents`,
  )
  invariant(
    offer.stripeLookupKey.trim().length > 0,
    `${context} Stripe lookup key must not be empty`,
  )
  invariant(
    !offerCodes.has(offer.offerCode),
    `duplicate offer ${offer.offerCode}`,
  )
  invariant(
    !lookupKeys.has(offer.stripeLookupKey),
    `duplicate lookup key ${offer.stripeLookupKey}`,
  )
  offerCodes.add(offer.offerCode)
  lookupKeys.add(offer.stripeLookupKey)
}

const packageAmounts = new Set(BILLING_CATALOG.topUps.packageAmountsUsdCents)
invariant(
  packageAmounts.size === BILLING_CATALOG.topUps.packageAmountsUsdCents.length,
  'top-up package shortcuts must be unique',
)
invariant(
  packageAmounts.has(BILLING_CATALOG.topUps.minAmountUsdCents)
  && packageAmounts.has(BILLING_CATALOG.topUps.maxAmountUsdCents),
  'top-up package shortcuts must include the minimum and maximum',
)
for (const amountUsdCents of packageAmounts) {
  invariant(
    amountUsdCents >= BILLING_CATALOG.topUps.minAmountUsdCents
    && amountUsdCents <= BILLING_CATALOG.topUps.maxAmountUsdCents
    && (
      amountUsdCents - BILLING_CATALOG.topUps.minAmountUsdCents
    ) % BILLING_CATALOG.topUps.stepUsdCents === 0,
    `invalid top-up package shortcut ${amountUsdCents}`,
  )
}
for (const planCode of ['creator', 'pro'] as const) {
  const plan: BillingCatalog['plans'][typeof planCode]
    = BILLING_CATALOG.plans[planCode]
  for (const option of plan.currentRecurringOptions) {
    invariant(
      !recurringOptionCodes.has(option.code),
      `duplicate recurring option ${option.code}`,
    )
    invariant(
      Number.isSafeInteger(option.monthlyCredits) && option.monthlyCredits > 0,
      `${option.code} monthly credits must be a positive integer`,
    )
    recurringOptionCodes.add(option.code)
    for (const interval of ['month', 'year'] as const) {
      const offer = option[interval]
      registerOffer(offer, `${planCode}/${option.code}/${interval}`)
    }
  }
  for (const offer of plan.historicalOffers) {
    invariant(
      offer.recurringOptionCode.trim().length > 0,
      `${offer.offerCode} historical recurring option must not be empty`,
    )
    invariant(
      Number.isSafeInteger(offer.monthlyCredits) && offer.monthlyCredits > 0,
      `${offer.offerCode} historical monthly credits must be a positive integer`,
    )
    registerOffer(
      offer,
      `${planCode}/${offer.recurringOptionCode}/${offer.billingInterval}/history`,
    )
    const resolved = findBillingOfferByStripeLookupKey(
      offer.stripeLookupKey,
      BILLING_CATALOG,
    )
    invariant(
      resolved?.currentForCheckout === false
      && resolved.billingInterval === offer.billingInterval
      && resolved.monthlyCredits === offer.monthlyCredits
      && resolved.offer.offerCode === offer.offerCode
      && resolved.planCode === planCode
      && resolved.recurringOptionCode === offer.recurringOptionCode,
      `${offer.offerCode} historical lookup is not executable`,
    )
  }
}
invariant(
  BILLING_CATALOG.plans.free.historicalOffers.length === 0,
  'Free must not contain historical recurring offers',
)

const historicalInvoiceOffer = {
  billingInterval: 'year',
  catalogRevision: '2026-06-30.1',
  monthlyCredits: 5_300,
  offerCode: 'catalog-verifier-history-only-offer',
  priceUsdCents: 54_800,
  recurringOptionCode: 'catalog-verifier-history-only-option',
  stripeLookupKey: 'catalog_verifier_history_only_lookup',
} as const
const historicalInvoiceCatalog: BillingCatalog = {
  ...BILLING_CATALOG,
  plans: {
    ...BILLING_CATALOG.plans,
    pro: {
      ...BILLING_CATALOG.plans.pro,
      historicalOffers: [historicalInvoiceOffer],
    },
  },
}
const resolvedHistoricalInvoiceOffer = findBillingOfferByStripeLookupKey(
  historicalInvoiceOffer.stripeLookupKey,
  historicalInvoiceCatalog,
)
invariant(
  resolvedHistoricalInvoiceOffer?.currentForCheckout === false
  && resolvedHistoricalInvoiceOffer.offer.offerCode
  === historicalInvoiceOffer.offerCode
  && resolvedHistoricalInvoiceOffer.monthlyCredits
  === historicalInvoiceOffer.monthlyCredits,
  'history-only invoice offer must resolve without becoming current Checkout',
)
invariant(
  getBillingOffer({
    billingInterval: historicalInvoiceOffer.billingInterval,
    planCode: 'pro',
    recurringOptionCode: historicalInvoiceOffer.recurringOptionCode,
  }) === null,
  'history-only invoice offer became selectable by Checkout',
)

for (const offer of currentRecurringOfferMargins()) {
  invariant(
    offer.marginBps
    >= BILLING_CATALOG.creditPolicy.minimumFullUseContributionMarginBps,
    `${offer.offerCode} contribution ${offer.marginBps}bps is below the floor`,
  )
}

for (const planCode of ['free', 'creator', 'pro'] as const) {
  const optionCodes = planCode === 'free'
    ? [null]
    : BILLING_CATALOG.plans[planCode].currentRecurringOptions.map(
        option => option.code,
      )
  for (const recurringOptionCode of optionCodes) {
    const quotes = generateTopUpQuotes({ planCode, recurringOptionCode })
    invariant(quotes.length === 77, `${planCode} top-up point count changed`)
    for (let index = 0; index < quotes.length; index += 1) {
      const quote = quotes[index]!
      const privateQuote = quoteTopUp({
        amountUsdCents: quote.amountUsdCents,
        planCode,
        recurringOptionCode,
      })
      invariant(
        privateQuote.modeledContributionMarginBps
        >= BILLING_CATALOG.creditPolicy.minimumFullUseContributionMarginBps,
        `${planCode}/${recurringOptionCode}/${quote.amountUsdCents} is below the contribution floor`,
      )
      if (index > 0) {
        const previous = quotes[index - 1]!
        invariant(quote.credits >= previous.credits, 'top-up credits are not monotonic')
        invariant(
          quote.volumeRateImprovementBps >= previous.volumeRateImprovementBps,
          'top-up volume value is not monotonic',
        )
      }
    }
  }
}

const configuredEndpointCodes = Object.keys(
  BILLING_CATALOG.topUps.creditsAtMaximumAmountByRecurringOptionCode,
)
invariant(
  configuredEndpointCodes.length === recurringOptionCodes.size
  && configuredEndpointCodes.every(code => recurringOptionCodes.has(code)),
  'paid top-up endpoints must match current recurring options exactly',
)

const expectedMaximumQuotes = new Map([
  ['free:null', { credits: 22_295, savingsBps: 4_000 }],
  ['creator:creator-1600', { credits: 34_666, savingsBps: 4_217 }],
  ['pro:pro-5300', { credits: 35_672, savingsBps: 2_500 }],
  ['pro:pro-11300', { credits: 38_220, savingsBps: 3_000 }],
  ['pro:pro-17300', { credits: 40_536, savingsBps: 3_399 }],
  ['pro:pro-29500', { credits: 46_204, savingsBps: 4_209 }],
])
for (const [key, expected] of expectedMaximumQuotes) {
  const [planCode, recurringOptionCode] = key.split(':') as [
    'creator' | 'free' | 'pro',
    string,
  ]
  const quote = quoteTopUp({
    amountUsdCents: 39_000,
    planCode,
    recurringOptionCode: recurringOptionCode === 'null'
      ? null
      : recurringOptionCode,
  })
  invariant(
    quote.credits === expected.credits,
    `${key} maximum top-up changed`,
  )
  invariant(
    quote.volumeRateImprovementBps === expected.savingsBps,
    `${key} maximum top-up savings changed`,
  )
}

let previousProMaximum = 0
for (const option of BILLING_CATALOG.plans.pro.currentRecurringOptions) {
  const maximum = quoteTopUp({
    amountUsdCents: BILLING_CATALOG.topUps.maxAmountUsdCents,
    planCode: 'pro',
    recurringOptionCode: option.code,
  })
  invariant(
    maximum.credits > previousProMaximum,
    'Pro top-up endpoints must improve with recurring commitment',
  )
  invariant(
    BigInt(BILLING_CATALOG.topUps.maxAmountUsdCents)
    * BigInt(option.monthlyCredits)
    >= BigInt(option.month.priceUsdCents) * BigInt(maximum.credits),
    `${option.code} top-up rate beats its monthly subscription`,
  )
  previousProMaximum = maximum.credits
}

const openRouterSeedance = quoteProviderCredits({
  provider: 'openrouter',
  rawProviderCostUsd: '10.8864',
})
const falSeedance = quoteProviderCredits({
  provider: 'fal',
  rawProviderCostUsd: '12.4416',
})
invariant(openRouterSeedance.credits === 2_680, 'OpenRouter Seedance 4K guard changed')
invariant(falSeedance.credits === 2_904, 'fal Seedance 4K guard changed')

const januaryAnchor = new Date('2028-01-31T14:30:00.000Z')
invariant(
  monthlyGrantBoundary(januaryAnchor, 1).toISOString()
  === '2028-02-29T14:30:00.000Z',
  'leap-year January 31 grant clamp changed',
)
invariant(
  monthlyGrantBoundary(januaryAnchor, 2).toISOString()
  === '2028-03-31T14:30:00.000Z',
  'monthly grant anchor drifted after February',
)
const annualPeriods = dueMonthlyGrantPeriods({
  anchor: januaryAnchor,
  now: new Date('2029-01-30T23:59:59.999Z'),
  paidThrough: new Date('2029-01-31T14:30:00.000Z'),
})
invariant(
  annualPeriods.length === 12
  && annualPeriods[11]?.startsAt.toISOString()
  === '2028-12-31T14:30:00.000Z',
  'annual service must release exactly twelve anchored monthly grants',
)
const annualRevenue = allocateAnnualRevenueUsdCents(19_201)
invariant(
  annualRevenue.length === 12
  && annualRevenue.reduce((sum, amount) => sum + amount, 0) === 19_201
  && annualRevenue[0] === 1_601
  && annualRevenue[1] === 1_600,
  'annual revenue allocation must preserve every cent deterministically',
)

console.log(
  `Billing catalog ${BILLING_CATALOG.revision} verified: `
  + `${offerCodes.size} offers, four Pro options, and all top-up curves.`,
)
