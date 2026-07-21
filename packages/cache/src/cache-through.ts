/** Cache-through loading with process-local in-flight request coalescing. */

import type { CacheStore } from './contracts.js'

const inFlightLoads = new WeakMap<CacheStore, Map<string, Promise<unknown>>>()

function loadsFor(cache: CacheStore): Map<string, Promise<unknown>> {
  const existing = inFlightLoads.get(cache)
  if (existing)
    return existing
  const created = new Map<string, Promise<unknown>>()
  inFlightLoads.set(cache, created)
  return created
}

/**
 * Returns a cached value or runs one shared loader for concurrent misses.
 * Values rejected by `shouldCache` are still coalesced while loading.
 *
 * TODO: A Redis CacheStore must add a bounded distributed loader lease with
 * `SET key token NX PX ttl`; release must compare the stored token and delete
 * atomically so an expired owner cannot remove a successor's lease. This
 * process-local WeakMap cannot coalesce misses across API instances.
 */
export async function getOrSetCachedValue<Value>(input: {
  /** Replaceable shared cache backing the lookup. */
  cache: CacheStore
  /** Exact namespaced cache key for the computed value. */
  key: string
  /** Loader invoked once for concurrent misses in this process. */
  load: () => Promise<Value>
  /** Optional policy preventing incomplete or unsafe values from being retained. */
  shouldCache?: (value: Value) => boolean
  /** Positive retained lifetime or value-sensitive lifetime in milliseconds. */
  ttlMs: number | ((value: Value) => number)
}): Promise<Value> {
  const cached = await input.cache.get<Value>(input.key)
  if (cached !== undefined)
    return cached

  const loads = loadsFor(input.cache)
  const inFlight = loads.get(input.key) as Promise<Value> | undefined
  if (inFlight)
    return inFlight

  const load = (async () => {
    const value = await input.load()
    if (input.shouldCache?.(value) ?? true) {
      const ttlMs = typeof input.ttlMs === 'function'
        ? input.ttlMs(value)
        : input.ttlMs
      await input.cache.set(input.key, value, { ttlMs })
    }
    return value
  })()
  loads.set(input.key, load)
  void load.finally(() => {
    if (loads.get(input.key) === load)
      loads.delete(input.key)
  }).catch(() => undefined)
  return load
}
