/**
 * Narrow execution types shared by the OpenRouter protocol modules.
 *
 */

import type {
  BrowserOpenRouterChatBinding,
  BrowserOpenRouterImageBinding,
  BrowserOpenRouterSpeechBinding,
  BrowserOpenRouterVideoBinding,
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

/** Narrow image binding facts disclosed to either execution driver. */
export type OpenRouterImageBinding = BrowserOpenRouterImageBinding

/** Narrow video binding facts disclosed to either execution driver. */
export type OpenRouterVideoBinding = BrowserOpenRouterVideoBinding

/** Narrow speech binding facts disclosed to either execution driver. */
export type OpenRouterSpeechBinding = BrowserOpenRouterSpeechBinding

/** Narrow chat binding facts disclosed to either execution driver. */
export type OpenRouterChatBinding = BrowserOpenRouterChatBinding
