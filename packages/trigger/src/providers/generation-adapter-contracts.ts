import type {
  GenerationOutputType,
  NormalizedGenerationProviderAdapter,
} from '@talelabs/flows'

/**
 * Complete immutable route identity frozen at admission. Adapter factories
 * receive this object so no worker re-derives execution from mutable defaults.
 */
export interface PinnedGenerationProviderRoute {
  adapterVersion: string
  modelContractVersion: string
  modelRegistryVersion: string
  operationId: string
  outputType: GenerationOutputType
  productModelId: string
  provider: string
  providerModel: string
  providerRouteVersion: string
}

export interface ResolvedGenerationProviderAdapter {
  adapter: NormalizedGenerationProviderAdapter
  route: Readonly<PinnedGenerationProviderRoute>
}
