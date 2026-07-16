/**
 * Universal runtime-service contracts shared by provider protocol cores.
 */

import type { NormalizedGenerationMediaAsset } from '@talelabs/flows'

/** Runtime-only OpenRouter API-key resolver selected by active composition. */
export interface OpenRouterRuntimeCredential {
  /** Provider discriminator used to reject credential/binding mismatches. */
  provider: 'openrouter'
  /** Resolves the secret immediately before authenticated client creation. */
  resolveApiKey: () => string | undefined
}

/** Runtime credentials accepted by provider protocol construction. */
export type ProviderRuntimeCredential = OpenRouterRuntimeCredential

/** Runtime-resolved Asset metadata consumed by provider protocol translation. */
export interface ResolvedProviderAsset {
  /** Canonical tenant-owned Asset identifier. */
  assetId: string
  /** Media duration in seconds when known. */
  durationSeconds: number | null
  /** Pixel height when known. */
  height: number | null
  /** Validated canonical MIME type. */
  mimeType: string
  /** Provider-readable URL resolved by the active browser or server runtime. */
  providerUrl: string
  /** Object size in bytes when known. */
  sizeBytes: number | null
  /** Pixel width when known. */
  width: number | null
}

/** Runtime-specific Asset resolver used by providers that accept media inputs. */
export type ProviderAssetResolver = (
  asset: NormalizedGenerationMediaAsset,
) => Promise<ResolvedProviderAsset>
