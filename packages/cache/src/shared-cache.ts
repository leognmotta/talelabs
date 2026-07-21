/** Application cache composition with isolated workload eviction budgets. */

import type { CacheStore } from './contracts.js'

import { InMemoryCacheStore } from './in-memory-cache-store.js'

const PROVIDER_COST_CACHE_MAX_ENTRIES = 20_000
const RATE_LIMIT_CACHE_MAX_ENTRIES = 50_000

// TODO: Replace these process-local stores with workload-isolated Redis-backed CacheStore instances once Redis is available.
/** Provider pricing and estimate cache isolated from admission counters. */
export const providerCostCache: CacheStore = new InMemoryCacheStore({
  maxEntries: PROVIDER_COST_CACHE_MAX_ENTRIES,
})

/** Organization admission counters isolated from high-cardinality estimates. */
export const rateLimitCache: CacheStore = new InMemoryCacheStore({
  maxEntries: RATE_LIMIT_CACHE_MAX_ENTRIES,
})
