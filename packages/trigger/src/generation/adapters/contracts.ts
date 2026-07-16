/** Immutable admitted provider route and resolved adapter contracts. */

import type {
  GenerationOutputType,
  GenerationProviderLifecycle,
  NormalizedGenerationProviderAdapter,
} from '@talelabs/flows'
import type { CatalogProviderBinding } from '@talelabs/models-catalog'

/**
 * Complete immutable route identity frozen at admission. Adapter factories
 * receive this object so no worker re-derives execution from mutable defaults.
 */
export interface PinnedGenerationProviderRoute {
  adapterVersion: string
  catalogRevision: string
  catalogVersion: number
  modelContractVersion: string
  modelRevision: number
  operationId: string
  outputType: GenerationOutputType
  productModelId: string
  provider: string
  providerEndpoint?: string
  /** Reviewed OpenRouter endpoint slug; absent only on historical snapshots. */
  providerEndpointTag?: string
  providerLifecycle?: GenerationProviderLifecycle
  providerModel: string
  providerRouteVersion: string
  /** Complete provider execution contract captured during admission. */
  providerBinding: CatalogProviderBinding
}

/** Runtime provider implementation paired with its immutable admitted route. */
export interface ResolvedGenerationProviderAdapter {
  adapter: NormalizedGenerationProviderAdapter
  requiresDurableSubmissionBoundary: boolean
  route: Readonly<PinnedGenerationProviderRoute>
}
