/** Cache-through loading with process-local in-flight request coalescing. */

import type { CacheStore } from './contracts.js'

interface InFlightLoad {
  controller: AbortController
  promise: Promise<unknown>
  settled: boolean
  waiters: number
}

const inFlightLoads = new WeakMap<CacheStore, Map<string, InFlightLoad>>()

function loadsFor(cache: CacheStore): Map<string, InFlightLoad> {
  const existing = inFlightLoads.get(cache)
  if (existing)
    return existing
  const created = new Map<string, InFlightLoad>()
  inFlightLoads.set(cache, created)
  return created
}

async function waitForInFlightLoad<Value>(input: {
  flight: InFlightLoad
  key: string
  loads: Map<string, InFlightLoad>
  signal?: AbortSignal
}): Promise<Value> {
  input.signal?.throwIfAborted()
  input.flight.waiters += 1
  let removeAbortListener: (() => void) | undefined
  try {
    if (!input.signal)
      return await input.flight.promise as Value

    const canceled = new Promise<never>((_resolve, reject) => {
      const handleAbort = () => reject(
        input.signal?.reason ?? new DOMException('Cache load canceled', 'AbortError'),
      )
      input.signal!.addEventListener('abort', handleAbort, { once: true })
      removeAbortListener = () => input.signal!.removeEventListener(
        'abort',
        handleAbort,
      )
      if (input.signal!.aborted)
        handleAbort()
    })
    return await Promise.race([
      input.flight.promise as Promise<Value>,
      canceled,
    ])
  }
  finally {
    removeAbortListener?.()
    input.flight.waiters -= 1
    if (input.flight.waiters === 0 && !input.flight.settled) {
      if (input.loads.get(input.key) === input.flight)
        input.loads.delete(input.key)
      input.flight.controller.abort(
        new DOMException('Shared cache load canceled', 'AbortError'),
      )
    }
  }
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
  /** Loader invoked once with shared cancellation for concurrent misses. */
  load: (signal: AbortSignal) => Promise<Value>
  /** Optional policy preventing incomplete or unsafe values from being retained. */
  shouldCache?: (value: Value) => boolean
  /** Optional caller cancellation that releases only this waiter. */
  signal?: AbortSignal
  /** Positive retained lifetime or value-sensitive lifetime in milliseconds. */
  ttlMs: number | ((value: Value) => number)
}): Promise<Value> {
  input.signal?.throwIfAborted()
  const cached = await input.cache.get<Value>(input.key)
  input.signal?.throwIfAborted()
  if (cached !== undefined)
    return cached

  const loads = loadsFor(input.cache)
  const inFlight = loads.get(input.key)
  if (inFlight) {
    return waitForInFlightLoad({
      flight: inFlight,
      key: input.key,
      loads,
      signal: input.signal,
    })
  }

  const controller = new AbortController()
  const flight: InFlightLoad = {
    controller,
    promise: Promise.resolve(undefined),
    settled: false,
    waiters: 0,
  }
  flight.promise = (async () => {
    const value = await input.load(controller.signal)
    controller.signal.throwIfAborted()
    if (input.shouldCache?.(value) ?? true) {
      const ttlMs = typeof input.ttlMs === 'function'
        ? input.ttlMs(value)
        : input.ttlMs
      await input.cache.set(input.key, value, { ttlMs })
    }
    return value
  })()
  loads.set(input.key, flight)
  void flight.promise.finally(() => {
    flight.settled = true
    if (loads.get(input.key) === flight)
      loads.delete(input.key)
  }).catch(() => undefined)
  return waitForInFlightLoad({
    flight,
    key: input.key,
    loads,
    signal: input.signal,
  })
}
