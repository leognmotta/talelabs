/** Short-lived keyed reuse of deterministic provider-cost calculations. */

import type { CacheStore } from '@talelabs/cache'
import type {
  ProviderCostEstimate,
  ProviderCostRequest,
  ProviderPricingSnapshot,
} from './contracts.js'

import {
  createCacheKey,
  getOrSetCachedValue,
  providerCostCache,
} from '@talelabs/cache'
import { hashCanonicalValue } from '@talelabs/flows'
import { estimateProviderCost } from './estimate.js'
import { loadProviderPricingSnapshot } from './load.js'

const PROVIDER_COST_ESTIMATE_CACHE_TTL_MS = 5 * 60_000
const PROVIDER_COST_UNAVAILABLE_CACHE_TTL_MS = 15_000

function providerCostEstimateKey(request: ProviderCostRequest): string {
  return createCacheKey('provider-cost-estimate:v1', [
    hashCanonicalValue('talelabs:provider-cost-estimate-cache:v1', request),
  ])
}

/**
 * Reuses one deterministic job estimate across equivalent plan scopes and page
 * loads. Unavailable results use a short negative lifetime to prevent pricing
 * outages from creating a request storm while still recovering promptly.
 */
export function estimateProviderCostCached(input: {
  /** Optional cache override used by deterministic verification. */
  cache?: CacheStore
  /** Optional current pricing override used by deterministic verification. */
  pricing?: ProviderPricingSnapshot
  /** Exact candidate binding and normalized provider-cost facts. */
  request: ProviderCostRequest
}): Promise<ProviderCostEstimate> {
  return getOrSetCachedValue({
    cache: input.cache ?? providerCostCache,
    key: providerCostEstimateKey(input.request),
    load: async () => estimateProviderCost({
      pricing: input.pricing ?? await loadProviderPricingSnapshot({
        bindings: [input.request.binding],
      }),
      request: input.request,
    }),
    ttlMs: estimate => estimate.status === 'estimated'
      ? PROVIDER_COST_ESTIMATE_CACHE_TTL_MS
      : PROVIDER_COST_UNAVAILABLE_CACHE_TTL_MS,
  })
}
