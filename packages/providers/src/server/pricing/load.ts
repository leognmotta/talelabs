/** Resilient loading and short-lived coalescing of provider pricing metadata. */

import type { CacheStore } from '@talelabs/cache'
import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type {
  OpenRouterImagePricingRate,
  OpenRouterTokenPricingRate,
  ProviderPricingRate,
  ProviderPricingSnapshot,
} from './contracts.js'

import {
  createCacheKey,
  getOrSetCachedValue,
  providerPricingCache,
} from '@talelabs/cache'
import { loadFalPricingRates } from '../../fal/server/pricing-client.js'
import {
  loadOpenRouterImagePricingRate,
  loadOpenRouterTokenPricingRate,
  loadOpenRouterVideoPricingRates,
} from '../../openrouter/server/pricing-client.js'
import { resolveProviderRuntimeCredential } from '../credentials.js'

const OPENROUTER_IMAGE_PRICING_CONCURRENCY = 4
const OPENROUTER_TOKEN_PRICING_CONCURRENCY = 6
const PROVIDER_PRICING_LOAD_ATTEMPTS = 2
const PROVIDER_PRICING_REQUEST_TIMEOUT_MS = 5_000
const PROVIDER_PRICING_SNAPSHOT_TTL_MS = 60_000
const PROVIDER_PRICING_UNAVAILABLE_TTL_MS = 15_000

async function loadProviderPricingWithRetry<Value, Recovered = never>(input: {
  load: () => Promise<Value>
  recover?: (error: unknown) => Recovered
  signal?: AbortSignal
}): Promise<Recovered | Value> {
  let lastError: unknown
  for (let attempt = 0; attempt < PROVIDER_PRICING_LOAD_ATTEMPTS; attempt += 1) {
    input.signal?.throwIfAborted()
    try {
      const value = await input.load()
      input.signal?.throwIfAborted()
      return value
    }
    catch (error) {
      lastError = error
      input.signal?.throwIfAborted()
    }
  }
  if (input.recover)
    return input.recover(lastError)
  throw lastError
}

function providerPricingBindingKey(binding: CatalogProviderBinding): string {
  const protocol = binding.provider === 'fal' ? 'fal' : binding.protocol
  const providerTag = binding.provider === 'openrouter' && binding.protocol !== 'video'
    ? binding.providerTag
    : ''
  return [
    binding.provider,
    protocol,
    binding.nativeModelId,
    providerTag,
  ].join('\u0000')
}

function providerPricingRateKey(rate: ProviderPricingRate): string {
  return [
    rate.provider,
    'protocol' in rate ? rate.protocol : 'pricingSkus' in rate ? 'video' : 'pricing' in rate ? 'image' : 'fal',
    rate.nativeModelId,
    'providerTag' in rate ? rate.providerTag : '',
  ].join('\u0000')
}

function providerPricingRateCacheKey(
  binding: CatalogProviderBinding,
): string {
  return createCacheKey('provider-pricing-rate:v1', [
    ...providerPricingBindingKey(binding).split('\u0000'),
  ])
}

function providerPricingLoadFlightKey(
  bindings: readonly CatalogProviderBinding[],
): string {
  return createCacheKey(
    'provider-pricing-load-flight:v1',
    bindings.map(providerPricingBindingKey).toSorted(),
  )
}

async function loadOpenRouterImageRates(input: {
  apiKey: string
  bindings: readonly CatalogProviderBinding[]
  fetch?: typeof globalThis.fetch
  retrievedAt: string
  signal?: AbortSignal
}): Promise<OpenRouterImagePricingRate[]> {
  const rates = Array.from({ length: input.bindings.length })
    .fill(undefined) as Array<OpenRouterImagePricingRate | undefined>
  let nextIndex = 0
  const workers = Array.from({
    length: Math.min(OPENROUTER_IMAGE_PRICING_CONCURRENCY, input.bindings.length),
  }, async () => {
    while (nextIndex < input.bindings.length) {
      input.signal?.throwIfAborted()
      const index = nextIndex
      nextIndex += 1
      const binding = input.bindings[index]!
      rates[index] = await loadProviderPricingWithRetry({
        load: () => loadOpenRouterImagePricingRate({
          apiKey: input.apiKey,
          fetch: input.fetch,
          nativeModelId: binding.nativeModelId,
          providerTag: binding.providerTag,
          retrievedAt: input.retrievedAt,
          signal: input.signal,
          timeoutMs: PROVIDER_PRICING_REQUEST_TIMEOUT_MS,
        }),
        recover: () => undefined,
        signal: input.signal,
      })
    }
  })
  await Promise.all(workers)
  input.signal?.throwIfAborted()
  return rates.flatMap(rate => rate ? [rate] : [])
}

async function loadOpenRouterTokenRates(input: {
  apiKey: string
  bindings: readonly CatalogProviderBinding[]
  fetch?: typeof globalThis.fetch
  retrievedAt: string
  signal?: AbortSignal
}): Promise<OpenRouterTokenPricingRate[]> {
  const rates = Array.from({ length: input.bindings.length })
    .fill(undefined) as Array<OpenRouterTokenPricingRate | undefined>
  let nextIndex = 0
  const workers = Array.from({
    length: Math.min(OPENROUTER_TOKEN_PRICING_CONCURRENCY, input.bindings.length),
  }, async () => {
    while (nextIndex < input.bindings.length) {
      input.signal?.throwIfAborted()
      const index = nextIndex
      nextIndex += 1
      const binding = input.bindings[index]!
      if (binding.provider !== 'openrouter' || (binding.protocol !== 'chat' && binding.protocol !== 'speech'))
        continue
      rates[index] = await loadProviderPricingWithRetry({
        load: () => loadOpenRouterTokenPricingRate({
          apiKey: input.apiKey,
          fetch: input.fetch,
          nativeModelId: binding.nativeModelId,
          protocol: binding.protocol,
          providerTag: binding.providerTag,
          retrievedAt: input.retrievedAt,
          signal: input.signal,
          timeoutMs: PROVIDER_PRICING_REQUEST_TIMEOUT_MS,
        }),
        recover: () => undefined,
        signal: input.signal,
      })
    }
  })
  await Promise.all(workers)
  input.signal?.throwIfAborted()
  return rates.flatMap(rate => rate ? [rate] : [])
}

async function loadOpenRouterRates(input: {
  apiKey: string
  bindings: readonly CatalogProviderBinding[]
  fetch?: typeof globalThis.fetch
  retrievedAt: string
  signal?: AbortSignal
}): Promise<ProviderPricingRate[]> {
  const openRouterBindings = input.bindings.filter(binding => binding.provider === 'openrouter')
  const videoIds = openRouterBindings
    .filter(binding => binding.protocol === 'video')
    .map(binding => binding.nativeModelId)
  const imageBindings = openRouterBindings
    .filter(binding => binding.protocol === 'image')
    .filter((binding, index, values) => values.findIndex(candidate =>
      candidate.nativeModelId === binding.nativeModelId
      && candidate.providerTag === binding.providerTag,
    ) === index)
  const tokenBindings = openRouterBindings
    .filter(binding => binding.protocol === 'chat' || binding.protocol === 'speech')
    .filter((binding, index, values) => values.findIndex(candidate =>
      candidate.nativeModelId === binding.nativeModelId
      && candidate.providerTag === binding.providerTag
      && candidate.protocol === binding.protocol,
    ) === index)
  const [videoResult, imageRates, tokenRates] = await Promise.all([
    loadProviderPricingWithRetry({
      load: () => loadOpenRouterVideoPricingRates({
        apiKey: input.apiKey,
        fetch: input.fetch,
        nativeModelIds: videoIds,
        retrievedAt: input.retrievedAt,
        signal: input.signal,
        timeoutMs: PROVIDER_PRICING_REQUEST_TIMEOUT_MS,
      }),
      recover: () => [],
      signal: input.signal,
    }),
    loadOpenRouterImageRates({
      apiKey: input.apiKey,
      bindings: imageBindings,
      fetch: input.fetch,
      retrievedAt: input.retrievedAt,
      signal: input.signal,
    }),
    loadOpenRouterTokenRates({
      apiKey: input.apiKey,
      bindings: tokenBindings,
      fetch: input.fetch,
      retrievedAt: input.retrievedAt,
      signal: input.signal,
    }),
  ])
  input.signal?.throwIfAborted()
  return [...videoResult, ...imageRates, ...tokenRates]
}

/** Performs one current pricing load without retaining credentials or results. */
async function loadProviderPricingSnapshotUncached(input: {
  /** Exact candidate bindings that may require pricing metadata. */
  bindings: readonly CatalogProviderBinding[]
  /** Injectable HTTP implementation used by focused verification. */
  fetch?: typeof globalThis.fetch
  /** Injectable clock used to make captured quote evidence deterministic. */
  now?: () => Date
  /** Optional server-only API-key resolver; secrets are never returned. */
  resolveApiKey?: (provider: 'fal' | 'openrouter') => string | undefined
  /** Optional caller cancellation signal. */
  signal?: AbortSignal
}): Promise<ProviderPricingSnapshot> {
  input.signal?.throwIfAborted()
  if (input.bindings.length === 0)
    return { rates: [], version: 1 }
  const resolveApiKey = input.resolveApiKey ?? ((provider) => {
    const credential = provider === 'fal'
      ? resolveProviderRuntimeCredential('fal')
      : resolveProviderRuntimeCredential('openrouter')
    return credential.resolveApiKey()
  })
  const retrievedAt = (input.now ?? (() => new Date()))().toISOString()
  const uniqueBindings = input.bindings.filter((binding, index, values) =>
    values.findIndex(candidate => providerPricingBindingKey(candidate)
      === providerPricingBindingKey(binding)) === index)
  const tasks: Promise<ProviderPricingRate[]>[] = []
  const falEndpointIds = uniqueBindings
    .filter(binding => binding.provider === 'fal')
    .map(binding => binding.nativeModelId)
  const falKey = falEndpointIds.length > 0
    ? resolveApiKey('fal')?.trim()
    : undefined
  if (falKey && falEndpointIds.length > 0) {
    tasks.push(loadProviderPricingWithRetry({
      load: () => loadFalPricingRates({
        apiKey: falKey,
        endpointIds: falEndpointIds,
        fetch: input.fetch,
        retrievedAt,
        signal: input.signal,
        timeoutMs: PROVIDER_PRICING_REQUEST_TIMEOUT_MS,
      }),
      recover: () => [],
      signal: input.signal,
    }))
  }
  const hasOpenRouterBindings = uniqueBindings.some(
    binding => binding.provider === 'openrouter',
  )
  const openRouterKey = hasOpenRouterBindings
    ? resolveApiKey('openrouter')?.trim()
    : undefined
  if (openRouterKey) {
    tasks.push(loadOpenRouterRates({
      apiKey: openRouterKey,
      bindings: uniqueBindings,
      fetch: input.fetch,
      retrievedAt,
      signal: input.signal,
    }))
  }
  const rates = (await Promise.all(tasks)).flat()
  input.signal?.throwIfAborted()
  return {
    rates,
    version: 1,
  }
}

/**
 * Loads current platform-account pricing with one-minute per-rate cache entries,
 * short negative entries, and exact-miss-set coalescing. Injected loaders remain
 * uncached unless verification supplies an isolated cache explicitly.
 */
export async function loadProviderPricingSnapshot(input: {
  /** Exact candidate bindings that may require pricing metadata. */
  bindings: readonly CatalogProviderBinding[]
  /** Optional isolated rate cache used by deterministic cache verification. */
  cache?: CacheStore
  /** Injectable HTTP implementation used by focused verification. */
  fetch?: typeof globalThis.fetch
  /** Injectable clock used to make captured quote evidence deterministic. */
  now?: () => Date
  /** Optional server-only API-key resolver; secrets are never returned. */
  resolveApiKey?: (provider: 'fal' | 'openrouter') => string | undefined
  /** Optional caller cancellation signal. */
  signal?: AbortSignal
}): Promise<ProviderPricingSnapshot> {
  input.signal?.throwIfAborted()
  if (input.bindings.length === 0)
    return { rates: [], version: 1 }
  const cache = input.cache ?? (
    input.fetch || input.now || input.resolveApiKey
      ? undefined
      : providerPricingCache
  )
  if (!cache)
    return loadProviderPricingSnapshotUncached(input)

  const bindings = input.bindings.filter((binding, index, values) =>
    values.findIndex(candidate => providerPricingBindingKey(candidate)
      === providerPricingBindingKey(binding)) === index)
  const keyedBindings = bindings.map(binding => ({
    binding,
    key: providerPricingRateCacheKey(binding),
  }))
  const misses: typeof keyedBindings = []
  await Promise.all(keyedBindings.map(async (keyedBinding) => {
    const rate = await cache.get<ProviderPricingRate | null>(keyedBinding.key)
    if (rate === undefined)
      misses.push(keyedBinding)
  }))
  input.signal?.throwIfAborted()

  if (misses.length > 0) {
    await getOrSetCachedValue({
      cache,
      key: providerPricingLoadFlightKey(misses.map(miss => miss.binding)),
      load: async (loadSignal) => {
        const unresolved: typeof misses = []
        await Promise.all(misses.map(async (miss) => {
          if (await cache.get<ProviderPricingRate | null>(miss.key) === undefined)
            unresolved.push(miss)
        }))
        loadSignal.throwIfAborted()
        if (unresolved.length === 0)
          return

        const snapshot = await loadProviderPricingSnapshotUncached({
          bindings: unresolved.map(miss => miss.binding),
          fetch: input.fetch,
          now: input.now,
          resolveApiKey: input.resolveApiKey,
          signal: loadSignal,
        })
        loadSignal.throwIfAborted()
        const ratesByIdentity = new Map(snapshot.rates.map(rate => [
          providerPricingRateKey(rate),
          rate,
        ]))
        await Promise.all(unresolved.map((miss) => {
          loadSignal.throwIfAborted()
          const rate = ratesByIdentity.get(
            providerPricingBindingKey(miss.binding),
          ) ?? null
          return cache.set(miss.key, rate, {
            ttlMs: rate === null
              ? PROVIDER_PRICING_UNAVAILABLE_TTL_MS
              : PROVIDER_PRICING_SNAPSHOT_TTL_MS,
          })
        }))
      },
      shouldCache: () => false,
      signal: input.signal,
      ttlMs: PROVIDER_PRICING_UNAVAILABLE_TTL_MS,
    })
  }

  input.signal?.throwIfAborted()
  const rates = await Promise.all(keyedBindings.map(async ({ key }) => (
    await cache.get<ProviderPricingRate | null>(key) ?? null
  )))
  input.signal?.throwIfAborted()
  return {
    rates: rates.flatMap(rate => rate ? [rate] : []),
    version: 1,
  }
}
