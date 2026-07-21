/**
 * Server-only contracts for deterministic preflight provider-cost estimates.
 *
 * Mutable rates stay in provider-owned snapshots while formulas consume the
 * immutable request and catalog binding selected for a prospective job.
 */

import type { CatalogProviderBinding } from '@talelabs/models-catalog'

/** Stable reasons why one provider request cannot be priced deterministically. */
export type ProviderCostUnavailableReason
  = | 'ambiguous_pricing'
    | 'cost_estimation_disabled'
    | 'input_metadata_unavailable'
    | 'pricing_unavailable'
    | 'unsupported_pricing_unit'
    | 'unsupported_request'

/** Immutable pricing evidence captured with a deterministic estimate. */
export interface ProviderCostBasis {
  /** Versioned calculator policy used to derive the estimate. */
  formulaVersion: string
  /** Provider-native model or endpoint identity whose rate was quoted. */
  pricingModelId: string
  /** Instant at which the provider pricing metadata was retrieved. */
  pricingRetrievedAt: string
  /** Authoritative provider metadata endpoint used for the mutable rate. */
  pricingSource: string
  /** Exact decimal rate in USD per provider billing unit. */
  unitPriceUsd: string
  /** Provider-authored billing unit interpreted by the formula. */
  unit: string
}

/** Deterministic estimate for one normalized provider request. */
export interface DeterministicProviderCostEstimate {
  /** Exact decimal USD amount, never a binary floating-point routing value. */
  amountUsd: string
  /** Immutable pricing and formula evidence for the amount. */
  basis: ProviderCostBasis
  /** Currency discriminator for the current routing policy. */
  currency: 'USD'
  /** Quantity of provider billing units used by the formula. */
  quantity: string
  /** Estimate classification accepted for cost-aware binding selection. */
  status: 'estimated'
}

/** Explicit non-estimate that must never be interpreted as zero cost. */
export interface UnavailableProviderCostEstimate {
  /** Stable reason suitable for aggregate diagnostics, not user-facing copy. */
  reason: ProviderCostUnavailableReason
  /** Discriminator preventing unavailable pricing from entering comparisons. */
  status: 'unavailable'
}

/** Result of attempting to price one normalized provider request. */
export type ProviderCostEstimate
  = | DeterministicProviderCostEstimate
    | UnavailableProviderCostEstimate

/** Locked metadata for one existing Asset referenced by a planned request. */
export interface ProviderCostInputAsset {
  /** Stable Asset identifier used only to match planned references. */
  assetId: string
  /** Known media duration in decimal seconds, when applicable. */
  durationSeconds: string | null
  /** Known pixel height for image or video input, when available. */
  height: number | null
  /** Provider-neutral media family captured by the Asset. */
  mediaType: 'audio' | 'image' | 'video'
  /** Known pixel width for image or video input, when available. */
  width: number | null
}

/** Provider-neutral facts needed to estimate one planned generation job. */
export interface ProviderCostRequest {
  /** Exact candidate binding being evaluated. */
  binding: CatalogProviderBinding
  /** Existing Asset metadata resolved from the admission lock set. */
  inputAssets: readonly ProviderCostInputAsset[]
  /** Whether the request depends on output whose metadata is unknown pre-run. */
  hasUnresolvedInputs: boolean
  /** Canonical creative model ID retained for diagnostics and formula matching. */
  modelId: string
  /** Provider-neutral operation ID for this request. */
  operationId: string
  /** Number of outputs requested by this single provider job. */
  outputCount: number
  /** Normalized model settings already validated by Flow planning. */
  settings: Readonly<Record<string, boolean | number | string>>
  /** Characters in the materialized text inputs after connected-slot precedence. */
  textCharacterCount: number
}

/** Current fal unit rate for one exact native endpoint. */
export interface FalProviderPricingRate {
  /** Provider currency; only USD can currently be estimated. */
  currency: string
  /** Exact fal endpoint ID returned by the pricing service. */
  nativeModelId: string
  /** Provider discriminator. */
  provider: 'fal'
  /** Instant at which this metadata response was retrieved. */
  retrievedAt: string
  /** Provider-authored billing unit. */
  unit: string
  /** Exact decimal rate per billing unit. */
  unitPriceUsd: string
}

/** Current OpenRouter image pricing for one pinned endpoint. */
export interface OpenRouterImagePricingRate {
  /** Model ID used by the image endpoints metadata route. */
  nativeModelId: string
  /** Provider-authored pricing lines for the exact pinned endpoint. */
  pricing: readonly {
    /** Provider billing category such as `output_image`. */
    billable: string
    /** Exact decimal cost in USD. */
    costUsd: string
    /** Unit such as `image` or `megapixel`. */
    unit: string
    /** Optional provider SKU variant such as `1k` or `2k`. */
    variant?: string
  }[]
  /** Provider discriminator. */
  provider: 'openrouter'
  /** Exact endpoint tag pinned by the catalog binding. */
  providerTag: string
  /** Instant at which this metadata response was retrieved. */
  retrievedAt: string
}

/** Current token pricing for one exact pinned OpenRouter endpoint. */
export interface OpenRouterTokenPricingRate {
  /** Maximum completion-token limit reported for this endpoint, when known. */
  maxCompletionTokens: number | null
  /** Maximum prompt-token limit reported for this endpoint, when known. */
  maxPromptTokens: number | null
  /** Model ID used by OpenRouter's endpoint metadata route. */
  nativeModelId: string
  /** Provider discriminator. */
  provider: 'openrouter'
  /** Exact endpoint tag pinned by the catalog binding. */
  providerTag: string
  /** Token-priced protocol whose request facts the formula interprets. */
  protocol: 'chat' | 'speech'
  /** Current per-unit decimal prices returned by the exact endpoint. */
  tokenPricing: Readonly<{
    /** Per-audio-token input price, when the endpoint reports one. */
    audio?: string
    /** Per-completion-token price. */
    completion?: string
    /** Per-image-token input price, when the endpoint reports one. */
    image?: string
    /** Per-internal-reasoning-token price, when separately reported. */
    internalReasoning?: string
    /** Per-prompt-token price. */
    prompt?: string
  }>
  /** Instant at which this metadata response was retrieved. */
  retrievedAt: string
}

/** Current OpenRouter video SKU table for one creative model. */
export interface OpenRouterVideoPricingRate {
  /** Model ID returned by OpenRouter's video model metadata route. */
  nativeModelId: string
  /** Provider discriminator. */
  provider: 'openrouter'
  /** Provider-authored SKU name to exact decimal USD rate. */
  pricingSkus: Readonly<Record<string, string>>
  /** Instant at which this metadata response was retrieved. */
  retrievedAt: string
}

/** Every provider pricing record understood by current estimators. */
export type ProviderPricingRate
  = | FalProviderPricingRate
    | OpenRouterImagePricingRate
    | OpenRouterTokenPricingRate
    | OpenRouterVideoPricingRate

/** Bounded provider pricing metadata loaded outside admission locks. */
export interface ProviderPricingSnapshot {
  /** Independent provider records; missing entries remain explicit unavailable. */
  rates: readonly ProviderPricingRate[]
  /** Snapshot version for future backwards-compatible quote readers. */
  version: 1
}
