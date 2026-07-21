/** Resilient loading and short-lived coalescing of provider pricing metadata. */

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
  providerCostCache,
} from '@talelabs/cache'
import { hashCanonicalValue } from '@talelabs/flows'
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

async function loadProviderPricingWithRetry<T>(input: {
  load: () => Promise<T>
  signal?: AbortSignal
}): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < PROVIDER_PRICING_LOAD_ATTEMPTS; attempt += 1) {
    try {
      return await input.load()
    }
    catch (error) {
      lastError = error
      if (input.signal?.aborted)
        throw error
    }
  }
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
    hashCanonicalValue(
      'talelabs:provider-pricing-rate-cache:v1',
      providerPricingBindingKey(binding),
    ),
  ])
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
        signal: input.signal,
      }).catch(() => undefined)
    }
  })
  await Promise.all(workers)
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
        signal: input.signal,
      }).catch(() => undefined)
    }
  })
  await Promise.all(workers)
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
      signal: input.signal,
    }).catch(() => []),
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
  const resolveApiKey = input.resolveApiKey ?? ((provider) => {
    const credential = provider === 'fal'
      ? resolveProviderRuntimeCredential('fal')
      : resolveProviderRuntimeCredential('openrouter')
    return credential.resolveApiKey()
  })
  const retrievedAt = (input.now ?? (() => new Date()))().toISOString()
  const uniqueBindings = input.bindings.filter((binding, index, values) =>
    values.findIndex(candidate =>
      candidate.provider === binding.provider
      && candidate.protocol === binding.protocol
      && candidate.nativeModelId === binding.nativeModelId
      && candidate.providerTag === binding.providerTag,
    ) === index)
  const tasks: Promise<ProviderPricingRate[]>[] = []
  const falKey = resolveApiKey('fal')?.trim()
  const falEndpointIds = uniqueBindings
    .filter(binding => binding.provider === 'fal')
    .map(binding => binding.nativeModelId)
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
      signal: input.signal,
    }).catch(() => []))
  }
  const openRouterKey = resolveApiKey('openrouter')?.trim()
  if (openRouterKey && uniqueBindings.some(binding => binding.provider === 'openrouter')) {
    tasks.push(loadOpenRouterRates({
      apiKey: openRouterKey,
      bindings: uniqueBindings,
      fetch: input.fetch,
      retrievedAt,
      signal: input.signal,
    }))
  }
  return {
    rates: (await Promise.all(tasks)).flat(),
    version: 1,
  }
}

/**
 * Loads current platform-account pricing with one-minute exact-binding cache
 * entries and in-flight coalescing. A changed binding loads only its missing
 * rate; incomplete rates and injected verification loaders bypass retention.
 */
export async function loadProviderPricingSnapshot(input: {
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
  if (input.fetch || input.now || input.resolveApiKey || input.bindings.length === 0)
    return loadProviderPricingSnapshotUncached(input)

  const bindings = input.bindings.filter((binding, index, values) =>
    values.findIndex(candidate => providerPricingBindingKey(candidate)
      === providerPricingBindingKey(binding)) === index)
  const keyedBindings = bindings.map(binding => ({
    binding,
    key: providerPricingRateCacheKey(binding),
  }))
  const ratesByKey = new Map<string, ProviderPricingRate>()
  const misses: typeof keyedBindings = []
  await Promise.all(keyedBindings.map(async (keyedBinding) => {
    const rate = await providerCostCache.get<ProviderPricingRate | null>(
      keyedBinding.key,
    )
    if (rate)
      ratesByKey.set(keyedBinding.key, rate)
    else
      misses.push(keyedBinding)
  }))

  let missingSnapshot: Promise<ProviderPricingSnapshot> | undefined
  await Promise.all(misses.map(async (keyedBinding) => {
    const rate = await getOrSetCachedValue<ProviderPricingRate | null>({
      cache: providerCostCache,
      key: keyedBinding.key,
      load: async () => {
        missingSnapshot ??= loadProviderPricingSnapshotUncached({
          bindings: misses.map(miss => miss.binding),
        })
        const snapshot = await missingSnapshot
        return snapshot.rates.find(candidate =>
          providerPricingRateKey(candidate)
          === providerPricingBindingKey(keyedBinding.binding)) ?? null
      },
      ttlMs: candidate => candidate === null
        ? PROVIDER_PRICING_UNAVAILABLE_TTL_MS
        : PROVIDER_PRICING_SNAPSHOT_TTL_MS,
    })
    if (rate)
      ratesByKey.set(keyedBinding.key, rate)
  }))

  return {
    rates: keyedBindings.flatMap(({ key }) => {
      const rate = ratesByKey.get(key)
      return rate ? [rate] : []
    }),
    version: 1,
  }
}
