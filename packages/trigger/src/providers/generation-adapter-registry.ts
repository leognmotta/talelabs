import type {
  GenerationOutputType,
} from '@talelabs/flows'

import type {
  PinnedGenerationProviderRoute,
  ResolvedGenerationProviderAdapter,
} from './generation-adapter-contracts.js'

import { getGenerationModel } from '@talelabs/flows'
import { createDeterministicMockAdapter } from './deterministic-mock-adapter.js'

const MOCK_ADAPTER_VERSION = 'mock-adapter-v1'
const MOCK_PROVIDER = 'talelabs-mock'

/** Resolves one immutable job route to its provider implementation. */
export function resolveGenerationProviderAdapter(input: {
  adapterVersion: string
  modelContractVersion: string
  modelRegistryVersion: string
  operationId: string
  outputType: GenerationOutputType
  productModelId: string
  provider: string
  providerModel: string
  providerRouteVersion: string
}): ResolvedGenerationProviderAdapter {
  const route = Object.freeze({ ...input }) satisfies Readonly<
    PinnedGenerationProviderRoute
  >
  const model = getGenerationModel(
    route.productModelId,
    route.modelContractVersion,
  )
  const operation = model?.operations.find(
    candidate => candidate.id === route.operationId,
  )
  if (
    !model
    || !operation
    || model.mediaType !== route.outputType
    || !route.modelRegistryVersion
    || !route.providerModel
    || !route.providerRouteVersion
  ) {
    throw new Error('generation_provider_route_invalid')
  }
  if (
    route.provider === MOCK_PROVIDER
    && route.adapterVersion === MOCK_ADAPTER_VERSION
  ) {
    return {
      adapter: createDeterministicMockAdapter({ route }),
      route,
    }
  }
  throw new Error('generation_provider_adapter_unavailable')
}
