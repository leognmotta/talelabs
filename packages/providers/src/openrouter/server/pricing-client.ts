/** Authenticated loaders for OpenRouter image endpoint and video SKU pricing. */

import type {
  OpenRouterImagePricingRate,
  OpenRouterTokenPricingRate,
  OpenRouterVideoPricingRate,
} from '../../server/pricing/contracts.js'

import { z } from 'zod'
import {
  providerPricingSignal,
  readProviderPricingJson,
} from '../../server/pricing/http.js'

const OPENROUTER_BASE_URL = 'https://openrouter.ai'
const decimalValueSchema = z.union([z.number().finite().nonnegative(), z.string().min(1)])
const imageEndpointsResponseSchema = z.object({
  endpoints: z.array(z.object({
    pricing: z.array(z.object({
      billable: z.string(),
      cost_usd: decimalValueSchema,
      unit: z.string(),
      variant: z.string().optional(),
    })),
    provider_tag: z.string(),
  })),
})
const modelEndpointsResponseSchema = z.object({
  data: z.object({
    endpoints: z.array(z.object({
      max_completion_tokens: z.number().int().nonnegative().nullable(),
      max_prompt_tokens: z.number().int().nonnegative().nullable(),
      pricing: z.record(z.string(), z.unknown()),
      tag: z.string(),
    })),
  }),
})
const videoModelsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    pricing_skus: z.record(z.string(), decimalValueSchema),
  })),
})

async function loadOpenRouterPricingJson(input: {
  apiKey: string
  fetch: typeof globalThis.fetch
  path: string
  signal?: AbortSignal
  timeoutMs: number
}): Promise<unknown> {
  const response = await input.fetch(`${OPENROUTER_BASE_URL}${input.path}`, {
    headers: { Authorization: `Bearer ${input.apiKey}` },
    signal: providerPricingSignal(input.signal, input.timeoutMs),
  })
  return readProviderPricingJson(response)
}

/** Loads the exact pinned endpoint pricing lines for one OpenRouter image model. */
export async function loadOpenRouterImagePricingRate(input: {
  /** OpenRouter platform API key resolved by server composition. */
  apiKey: string
  /** Injectable HTTP implementation used by focused verification. */
  fetch?: typeof globalThis.fetch
  /** Exact creative model ID used by the OpenRouter images metadata path. */
  nativeModelId: string
  /** Exact endpoint tag pinned in the catalog binding. */
  providerTag: string
  /** Shared metadata retrieval instant captured into the returned rate. */
  retrievedAt: string
  /** Optional caller cancellation signal. */
  signal?: AbortSignal
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
}): Promise<OpenRouterImagePricingRate | undefined> {
  const [author, ...slugParts] = input.nativeModelId.split('/')
  const slug = slugParts.join('/')
  if (!author || !slug)
    return undefined
  const json = await loadOpenRouterPricingJson({
    apiKey: input.apiKey,
    fetch: input.fetch ?? globalThis.fetch,
    path: `/api/v1/images/models/${encodeURIComponent(author)}/${encodeURIComponent(slug)}/endpoints`,
    signal: input.signal,
    timeoutMs: input.timeoutMs ?? 2_500,
  })
  const endpoint = imageEndpointsResponseSchema.parse(json).endpoints.find(candidate => candidate.provider_tag === input.providerTag)
  if (!endpoint)
    return undefined
  return {
    nativeModelId: input.nativeModelId,
    pricing: endpoint.pricing.map(line => ({
      billable: line.billable,
      costUsd: String(line.cost_usd),
      unit: line.unit,
      ...(line.variant ? { variant: line.variant } : {}),
    })),
    provider: 'openrouter',
    providerTag: input.providerTag,
    retrievedAt: input.retrievedAt,
  }
}

function decimalPricingField(
  pricing: Readonly<Record<string, unknown>>,
  field: string,
): string | undefined {
  const value = pricing[field]
  return typeof value === 'number' || typeof value === 'string'
    ? String(value)
    : undefined
}

/** Loads token prices for one exact pinned OpenRouter chat or speech endpoint. */
export async function loadOpenRouterTokenPricingRate(input: {
  /** OpenRouter platform API key resolved by server composition. */
  apiKey: string
  /** Injectable HTTP implementation used by focused verification. */
  fetch?: typeof globalThis.fetch
  /** Exact creative model ID used by OpenRouter's endpoint metadata path. */
  nativeModelId: string
  /** Exact endpoint tag pinned in the catalog binding. */
  providerTag: string
  /** Token-priced protocol whose request facts will be estimated. */
  protocol: 'chat' | 'speech'
  /** Shared metadata retrieval instant captured into the returned rate. */
  retrievedAt: string
  /** Optional caller cancellation signal. */
  signal?: AbortSignal
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
}): Promise<OpenRouterTokenPricingRate | undefined> {
  const json = await loadOpenRouterPricingJson({
    apiKey: input.apiKey,
    fetch: input.fetch ?? globalThis.fetch,
    path: `/api/v1/models/${input.nativeModelId.split('/').map(encodeURIComponent).join('/')}/endpoints`,
    signal: input.signal,
    timeoutMs: input.timeoutMs ?? 2_500,
  })
  const endpoints = modelEndpointsResponseSchema.parse(json).data.endpoints
  const endpoint = endpoints.find(candidate => candidate.tag === input.providerTag)
  if (!endpoint)
    return undefined
  const audio = decimalPricingField(endpoint.pricing, 'audio')
  const completion = decimalPricingField(endpoint.pricing, 'completion')
  const image = decimalPricingField(endpoint.pricing, 'image')
  const internalReasoning = decimalPricingField(endpoint.pricing, 'internal_reasoning')
  const prompt = decimalPricingField(endpoint.pricing, 'prompt')
  return {
    maxCompletionTokens: endpoint.max_completion_tokens,
    maxPromptTokens: endpoint.max_prompt_tokens,
    nativeModelId: input.nativeModelId,
    provider: 'openrouter',
    providerTag: input.providerTag,
    protocol: input.protocol,
    retrievedAt: input.retrievedAt,
    tokenPricing: {
      ...(audio ? { audio } : {}),
      ...(completion ? { completion } : {}),
      ...(image ? { image } : {}),
      ...(internalReasoning ? { internalReasoning } : {}),
      ...(prompt ? { prompt } : {}),
    },
  }
}

/** Loads current video SKU tables for all requested OpenRouter model IDs. */
export async function loadOpenRouterVideoPricingRates(input: {
  /** OpenRouter platform API key resolved by server composition. */
  apiKey: string
  /** Injectable HTTP implementation used by focused verification. */
  fetch?: typeof globalThis.fetch
  /** Exact video model IDs required by the current request. */
  nativeModelIds: readonly string[]
  /** Shared metadata retrieval instant captured into every returned rate. */
  retrievedAt: string
  /** Optional caller cancellation signal. */
  signal?: AbortSignal
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
}): Promise<OpenRouterVideoPricingRate[]> {
  const requested = new Set(input.nativeModelIds)
  if (requested.size === 0)
    return []
  const json = await loadOpenRouterPricingJson({
    apiKey: input.apiKey,
    fetch: input.fetch ?? globalThis.fetch,
    path: '/api/v1/videos/models',
    signal: input.signal,
    timeoutMs: input.timeoutMs ?? 2_500,
  })
  return videoModelsResponseSchema.parse(json).data.filter(model => requested.has(model.id)).map(model => ({
    nativeModelId: model.id,
    pricingSkus: Object.fromEntries(Object.entries(model.pricing_skus)
      .map(([key, value]) => [key, String(value)])),
    provider: 'openrouter',
    retrievedAt: input.retrievedAt,
  }))
}
