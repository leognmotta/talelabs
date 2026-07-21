/** Authenticated, bounded loader for fal endpoint unit pricing metadata. */

import type { FalProviderPricingRate } from '../../server/pricing/contracts.js'

import { z } from 'zod'
import {
  providerPricingSignal,
  readProviderPricingJson,
} from '../../server/pricing/http.js'

const FAL_PRICING_URL = 'https://api.fal.ai/v1/models/pricing'
const FAL_PRICING_BATCH_SIZE = 50
const falPricingResponseSchema = z.object({
  prices: z.array(z.object({
    currency: z.string(),
    endpoint_id: z.string(),
    unit: z.string(),
    unit_price: z.number().finite().nonnegative(),
  })),
})

async function loadFalPricingBatch(input: {
  apiKey: string
  endpointIds: readonly string[]
  fetch: typeof globalThis.fetch
  retrievedAt: string
  signal?: AbortSignal
  timeoutMs: number
}): Promise<FalProviderPricingRate[]> {
  const url = new URL(FAL_PRICING_URL)
  for (const endpointId of input.endpointIds)
    url.searchParams.append('endpoint_id', endpointId)
  const response = await input.fetch(url, {
    headers: { Authorization: `Key ${input.apiKey}` },
    signal: providerPricingSignal(input.signal, input.timeoutMs),
  })
  const parsed = falPricingResponseSchema.parse(
    await readProviderPricingJson(response),
  )
  return parsed.prices.map(price => ({
    currency: price.currency,
    nativeModelId: price.endpoint_id,
    provider: 'fal',
    retrievedAt: input.retrievedAt,
    unit: price.unit,
    unitPriceUsd: String(price.unit_price),
  }))
}

/** Loads current fal unit rates for exact catalog endpoint IDs. */
export async function loadFalPricingRates(input: {
  /** fal platform API key resolved by server composition. */
  apiKey: string
  /** Exact native endpoint IDs needed by the current request. */
  endpointIds: readonly string[]
  /** Injectable HTTP implementation used by focused verification. */
  fetch?: typeof globalThis.fetch
  /** Shared metadata retrieval instant captured into every returned rate. */
  retrievedAt: string
  /** Optional caller cancellation signal. */
  signal?: AbortSignal
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
}): Promise<FalProviderPricingRate[]> {
  const endpointIds = [...new Set(input.endpointIds)].toSorted()
  const batches: string[][] = []
  for (let index = 0; index < endpointIds.length; index += FAL_PRICING_BATCH_SIZE)
    batches.push(endpointIds.slice(index, index + FAL_PRICING_BATCH_SIZE))
  const results = await Promise.all(batches.map(endpointBatch => loadFalPricingBatch({
    apiKey: input.apiKey,
    endpointIds: endpointBatch,
    fetch: input.fetch ?? globalThis.fetch,
    retrievedAt: input.retrievedAt,
    signal: input.signal,
    timeoutMs: input.timeoutMs ?? 2_500,
  })))
  return results.flat()
}
