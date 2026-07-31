/** Idempotent dry-run/apply synchronization of test-mode Stripe catalog rows. */

import type { BillingCatalog } from '@talelabs/billing'
import type { StripeClient } from '../src/index.js'

import process from 'node:process'
import {
  BILLING_CATALOG,
} from '@talelabs/billing'

import {
  assertStripeTestMode,
  createStripeClient,
  verifyHistoricalStripePrice,
} from '../src/index.js'

const apply = process.argv.includes('--apply')
const stripe = createStripeClient()

interface ProductSpec {
  code: 'creator' | 'credits' | 'pro'
  name: string
}

const productSpecs: readonly ProductSpec[] = [
  { code: 'creator', name: 'TaleLabs Creator' },
  { code: 'pro', name: 'TaleLabs Pro' },
  { code: 'credits', name: 'TaleLabs Credits' },
]

async function findProduct(client: StripeClient, code: ProductSpec['code']) {
  const matches = []
  for await (const product of client.products.list({ active: true, limit: 100 })) {
    if (product.metadata.talelabs_code === code)
      matches.push(product)
    if (matches.length > 1)
      throw new Error(`Duplicate active Stripe Product: ${code}`)
  }
  return matches[0] ?? null
}

async function resolveProduct(spec: ProductSpec) {
  const current = await findProduct(stripe, spec.code)
  if (current) {
    if (current.livemode)
      throw new Error(`Live Stripe Product refused: ${spec.code}`)
    const matches = current.name === spec.name
      && current.metadata.talelabs_catalog_revision
      === BILLING_CATALOG.revision
    if (matches)
      return current
    if (!apply) {
      console.log(`[dry-run] update Product ${spec.code}`)
      return current
    }
    const updated = await stripe.products.update(current.id, {
      metadata: {
        talelabs_catalog_revision: BILLING_CATALOG.revision,
        talelabs_code: spec.code,
      },
      name: spec.name,
    })
    if (updated.livemode)
      throw new Error(`Unexpected live Stripe Product: ${spec.code}`)
    console.log(`updated Product ${spec.code}`)
    return updated
  }
  if (!apply) {
    console.log(`[dry-run] create Product ${spec.code}`)
    return null
  }
  const product = await stripe.products.create({
    active: true,
    metadata: {
      talelabs_catalog_revision: BILLING_CATALOG.revision,
      talelabs_code: spec.code,
    },
    name: spec.name,
  }, { idempotencyKey: `talelabs-product-${spec.code}` })
  if (product.livemode)
    throw new Error(`Unexpected live Stripe Product: ${spec.code}`)
  console.log(`created Product ${spec.code}`)
  return product
}

async function syncPrice(input: {
  catalogRevision: string
  interval: 'month' | 'year'
  offerCode: string
  planCode: 'creator' | 'pro'
  priceUsdCents: number
  product: NonNullable<Awaited<ReturnType<typeof resolveProduct>>>
  recurringOptionCode: string
  stripeLookupKey: string
  monthlyCredits: number
}) {
  const existing = await stripe.prices.list({
    active: true,
    limit: 2,
    lookup_keys: [input.stripeLookupKey],
  })
  if (existing.data.length > 1)
    throw new Error(`Duplicate Stripe lookup key: ${input.stripeLookupKey}`)
  const price = existing.data[0]
  if (price) {
    const productId = typeof price.product === 'string'
      ? price.product
      : price.product.id
    const matches = !price.livemode
      && price.currency === 'usd'
      && price.unit_amount === input.priceUsdCents
      && price.recurring?.interval === input.interval
      && productId === input.product.id
      && price.metadata.talelabs_catalog_revision === input.catalogRevision
      && price.metadata.talelabs_offer_code === input.offerCode
      && price.metadata.talelabs_monthly_credits === String(input.monthlyCredits)
      && price.metadata.talelabs_plan_code === input.planCode
      && price.metadata.talelabs_recurring_option_code
      === input.recurringOptionCode
    if (!matches)
      throw new Error(`Stripe Price drift: ${input.stripeLookupKey}`)
    return
  }
  if (!apply) {
    console.log(`[dry-run] create Price ${input.stripeLookupKey}`)
    return
  }
  const created = await stripe.prices.create({
    active: true,
    currency: 'usd',
    lookup_key: input.stripeLookupKey,
    metadata: {
      talelabs_catalog_revision: input.catalogRevision,
      talelabs_monthly_credits: String(input.monthlyCredits),
      talelabs_offer_code: input.offerCode,
      talelabs_plan_code: input.planCode,
      talelabs_recurring_option_code: input.recurringOptionCode,
    },
    product: input.product.id,
    recurring: { interval: input.interval },
    unit_amount: input.priceUsdCents,
  }, { idempotencyKey: `talelabs-price-${input.offerCode}` })
  if (created.livemode)
    throw new Error(`Unexpected live Stripe Price: ${input.stripeLookupKey}`)
  console.log(`created Price ${input.stripeLookupKey}`)
}

async function main() {
  assertStripeTestMode()
  const products = new Map<ProductSpec['code'], Awaited<ReturnType<typeof resolveProduct>>>()
  for (const spec of productSpecs)
    products.set(spec.code, await resolveProduct(spec))
  for (const planCode of ['creator', 'pro'] as const) {
    const plan: BillingCatalog['plans'][typeof planCode]
      = BILLING_CATALOG.plans[planCode]
    const product = products.get(planCode)
    if (!product) {
      if (apply || plan.historicalOffers.length)
        throw new Error(`Stripe Product missing for catalog: ${planCode}`)
      continue
    }
    for (const option of plan.currentRecurringOptions) {
      for (const interval of ['month', 'year'] as const) {
        const offer = option[interval]
        await syncPrice({
          catalogRevision: offer.catalogRevision,
          interval,
          monthlyCredits: option.monthlyCredits,
          offerCode: offer.offerCode,
          planCode,
          priceUsdCents: offer.priceUsdCents,
          product,
          recurringOptionCode: option.code,
          stripeLookupKey: offer.stripeLookupKey,
        })
      }
    }
    for (const offer of plan.historicalOffers) {
      await verifyHistoricalStripePrice(
        {
          offer,
          planCode,
          stripeProductId: product.id,
        },
        stripe,
      )
      console.log(`verified historical Price ${offer.stripeLookupKey}`)
    }
  }
  console.log(
    `${apply ? 'Applied' : 'Dry-run complete for'} Stripe test catalog ${
      BILLING_CATALOG.revision}`,
  )
}

await main()
