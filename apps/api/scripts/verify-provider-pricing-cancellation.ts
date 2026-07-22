/** Abort and coalescing verification for the shared provider pricing cache. */

import type { CatalogProviderBinding } from '@talelabs/models-catalog'

import assert from 'node:assert/strict'

import { InMemoryCacheStore } from '@talelabs/cache'
import { loadProviderPricingSnapshot } from '@talelabs/providers/server'

const FIXTURE_NOW = () => new Date('2026-07-21T12:00:00.000Z')

/** Verifies canceled pricing loads neither poison misses nor cancel active peers. */
export async function verifyProviderPricingCancellation(input: {
  /** One Fal binding whose pricing endpoint is represented by one request. */
  binding: CatalogProviderBinding
  /** Successful deterministic provider response used after cancellation. */
  fetch: typeof globalThis.fetch
  /** Current successful-fixture request count for cache-miss assertions. */
  requestCount: () => number
}): Promise<void> {
  const canceledCache = new InMemoryCacheStore({ maxEntries: 10 })
  const canceledController = new AbortController()
  let canceledPricingRequestCount = 0
  let markCanceledRequestStarted!: () => void
  const canceledRequestStarted = new Promise<void>((resolve) => {
    markCanceledRequestStarted = resolve
  })
  const canceledFetch: typeof globalThis.fetch = async (_request, init) => {
    canceledPricingRequestCount += 1
    markCanceledRequestStarted()
    const signal = init?.signal
    assert.ok(signal)
    return new Promise<Response>((_resolve, reject) => {
      const rejectCanceled = () => reject(
        signal.reason ?? new DOMException('Fixture canceled', 'AbortError'),
      )
      if (signal.aborted)
        rejectCanceled()
      else
        signal.addEventListener('abort', rejectCanceled, { once: true })
    })
  }
  const canceledLoad = loadProviderPricingSnapshot({
    bindings: [input.binding],
    cache: canceledCache,
    fetch: canceledFetch,
    now: FIXTURE_NOW,
    resolveApiKey: () => 'fixture-key',
    signal: canceledController.signal,
  })
  await canceledRequestStarted
  canceledController.abort(new DOMException('Fixture canceled', 'AbortError'))
  await assert.rejects(
    canceledLoad,
    error => error instanceof DOMException && error.name === 'AbortError',
  )
  assert.equal(canceledPricingRequestCount, 1)

  const postCancelRequestStart = input.requestCount()
  const postCancelPricing = await loadProviderPricingSnapshot({
    bindings: [input.binding],
    cache: canceledCache,
    fetch: input.fetch,
    now: FIXTURE_NOW,
    resolveApiKey: () => 'fixture-key',
  })
  assert.equal(input.requestCount() - postCancelRequestStart, 1)
  assert.equal(postCancelPricing.rates.length, 1)

  const sharedCache = new InMemoryCacheStore({ maxEntries: 10 })
  const sharedCancellationController = new AbortController()
  let sharedPricingRequestCount = 0
  let sharedProviderSignal: AbortSignal | undefined
  let markSharedRequestStarted!: () => void
  let releaseSharedRequest!: () => void
  const sharedRequestStarted = new Promise<void>((resolve) => {
    markSharedRequestStarted = resolve
  })
  const sharedRequestGate = new Promise<void>((resolve) => {
    releaseSharedRequest = resolve
  })
  const sharedFetch: typeof globalThis.fetch = async (request, init) => {
    sharedPricingRequestCount += 1
    sharedProviderSignal = init?.signal ?? undefined
    markSharedRequestStarted()
    await sharedRequestGate
    sharedProviderSignal?.throwIfAborted()
    return input.fetch(request)
  }
  const activeSharedLoad = loadProviderPricingSnapshot({
    bindings: [input.binding],
    cache: sharedCache,
    fetch: sharedFetch,
    now: FIXTURE_NOW,
    resolveApiKey: () => 'fixture-key',
  })
  const canceledSharedLoad = loadProviderPricingSnapshot({
    bindings: [input.binding],
    cache: sharedCache,
    fetch: sharedFetch,
    now: FIXTURE_NOW,
    resolveApiKey: () => 'fixture-key',
    signal: sharedCancellationController.signal,
  })
  await sharedRequestStarted
  sharedCancellationController.abort(
    new DOMException('Fixture canceled', 'AbortError'),
  )
  await assert.rejects(
    canceledSharedLoad,
    error => error instanceof DOMException && error.name === 'AbortError',
  )
  assert.equal(sharedProviderSignal?.aborted, false)
  releaseSharedRequest()
  assert.equal((await activeSharedLoad).rates.length, 1)
  assert.equal(sharedPricingRequestCount, 1)
}
