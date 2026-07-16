import type {
  GenerationOutputType,
  GenerationProviderLifecycle,
} from '@talelabs/flows'

import type {
  PinnedGenerationProviderRoute,
  ResolvedGenerationProviderAdapter,
} from './contracts.js'

import {
  GENERATION_MODEL_CONTRACT_VERSION,
  generationProviderLifecyclesEqual,
  getGenerationModel,
} from '@talelabs/flows'
import {
  getGenerationProviderRouteForSnapshot,
  OPENROUTER_PROVIDER,
} from '@talelabs/openrouter'
import { createGenerationAssetResolver } from '../inputs/asset-resolver.js'
import { createDeterministicMockAdapter } from './mock/adapter.js'
import { createOpenRouterChatAdapter } from './openrouter/chat/adapter.js'
import { createOpenRouterImageAdapter } from './openrouter/image/adapter.js'
import { createOpenRouterSpeechAdapter } from './openrouter/speech/adapter.js'
import { createOpenRouterVideoAdapter } from './openrouter/video/adapter.js'

const MOCK_ADAPTER_VERSION = 'mock-adapter-v1'
const MOCK_PROVIDER = 'talelabs-mock'

/** Resolves one immutable job route to its provider implementation. */
export function resolveGenerationProviderAdapter(input: {
  adapterVersion: string
  modelContractVersion: string
  modelRegistryVersion: string
  operationId: string
  organizationId: string
  outputType: GenerationOutputType
  productModelId: string
  provider: string
  providerEndpoint?: string
  providerEndpointTag?: string
  providerLifecycle?: GenerationProviderLifecycle
  providerModel: string
  providerRouteVersion: string
}): ResolvedGenerationProviderAdapter {
  const { organizationId, ...pinnedRoute } = input
  const route = Object.freeze(pinnedRoute) satisfies Readonly<
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
      requiresDurableSubmissionBoundary: false,
      route,
    }
  }
  if (route.provider === OPENROUTER_PROVIDER) {
    const approved = getGenerationProviderRouteForSnapshot({
      modelContractVersion: route.modelContractVersion,
      operationId: route.operationId,
      productModelId: route.productModelId,
      routeVersion: route.providerRouteVersion,
    })
    if (
      !approved
      || approved.adapterVersion !== route.adapterVersion
      || approved.providerRoute.endpoint !== route.providerEndpoint
      || (route.providerEndpointTag === undefined
        ? route.modelContractVersion === GENERATION_MODEL_CONTRACT_VERSION
        : approved.providerRoute.providerTag !== route.providerEndpointTag)
      || approved.outputType !== route.outputType
      || approved.providerRoute.nativeModelId !== route.providerModel
      || !generationProviderLifecyclesEqual(
        approved.lifecycle,
        route.providerLifecycle,
      )
    ) {
      throw new Error('generation_provider_route_invalid')
    }
    const resolveAsset = createGenerationAssetResolver(organizationId)
    const adapter = approved.requestProfile.kind === 'image'
      ? createOpenRouterImageAdapter({
          profile: approved.requestProfile,
          resolveAsset,
          route,
        })
      : approved.requestProfile.kind === 'video'
        ? createOpenRouterVideoAdapter({
            profile: approved.requestProfile,
            resolveAsset,
            route,
          })
        : approved.requestProfile.kind === 'speech'
          ? createOpenRouterSpeechAdapter({
              profile: approved.requestProfile,
              route,
            })
          : approved.requestProfile.kind === 'chat'
            ? createOpenRouterChatAdapter({
                profile: approved.requestProfile,
                resolveAsset,
                route,
              })
            : undefined
    if (
      !adapter
      || !generationProviderLifecyclesEqual(
        route.providerLifecycle,
        adapter.lifecycle,
      )
    ) {
      throw new Error('generation_provider_route_invalid')
    }
    return {
      adapter,
      requiresDurableSubmissionBoundary:
        approved.requiresDurableSubmissionBoundary,
      route,
    }
  }
  throw new Error('generation_provider_adapter_unavailable')
}
