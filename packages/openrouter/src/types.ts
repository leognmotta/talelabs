/**
 * Narrow execution types shared by the OpenRouter protocol modules.
 *
 */

import type { NormalizedGenerationMediaAsset } from '@talelabs/flows'
import type {
  CatalogChatRequestProfile,
  CatalogImageRequestProfile,
  CatalogProviderBinding,
  CatalogSpeechRequestProfile,
  CatalogVideoRequestProfile,
} from '@talelabs/models-catalog'

/** Asset metadata and signed URL resolved by the durable worker. */
export interface ResolvedOpenRouterAsset {
  assetId: string
  durationSeconds: number | null
  height: number | null
  mimeType: string
  signedReadUrl: string
  sizeBytes: number | null
  width: number | null
}

/** Tenant-aware resolver injected by Trigger without leaking database access. */
export type OpenRouterAssetResolver = (
  asset: NormalizedGenerationMediaAsset,
) => Promise<ResolvedOpenRouterAsset>

/** Immutable image binding captured in an admitted run snapshot. */
export type OpenRouterImageBinding = CatalogProviderBinding & {
  protocol: 'image'
  requestProfile: CatalogImageRequestProfile
}

/** Immutable video binding captured in an admitted run snapshot. */
export type OpenRouterVideoBinding = CatalogProviderBinding & {
  protocol: 'video'
  requestProfile: CatalogVideoRequestProfile
}

/** Immutable speech binding captured in an admitted run snapshot. */
export type OpenRouterSpeechBinding = CatalogProviderBinding & {
  protocol: 'speech'
  requestProfile: CatalogSpeechRequestProfile
}

/** Immutable chat binding captured in an admitted run snapshot. */
export type OpenRouterChatBinding = CatalogProviderBinding & {
  protocol: 'chat'
  requestProfile: CatalogChatRequestProfile
}
