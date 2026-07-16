/**
 * Narrow execution types shared by the OpenRouter protocol modules.
 *
 */

import type {
  CatalogOpenRouterChatBinding,
  CatalogOpenRouterImageBinding,
  CatalogOpenRouterSpeechBinding,
  CatalogOpenRouterVideoBinding,
} from '@talelabs/models-catalog'
import type {
  ProviderAssetResolver,
  ResolvedProviderAsset,
} from '../contracts.js'

export type { OpenRouterRuntimeCredential } from '../contracts.js'

/** Asset metadata and signed URL resolved by the durable worker. */
export type ResolvedOpenRouterAsset = ResolvedProviderAsset

/** Tenant-aware resolver injected by Trigger without leaking database access. */
export type OpenRouterAssetResolver = ProviderAssetResolver

/** Immutable image binding captured in an admitted run snapshot. */
export type OpenRouterImageBinding = CatalogOpenRouterImageBinding

/** Immutable video binding captured in an admitted run snapshot. */
export type OpenRouterVideoBinding = CatalogOpenRouterVideoBinding

/** Immutable speech binding captured in an admitted run snapshot. */
export type OpenRouterSpeechBinding = CatalogOpenRouterSpeechBinding

/** Immutable chat binding captured in an admitted run snapshot. */
export type OpenRouterChatBinding = CatalogOpenRouterChatBinding
