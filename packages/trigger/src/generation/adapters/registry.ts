/** Provider registry resolving captured bindings without reshaping requests. */

import type {
  FlowRunExecutionMode,
  GenerationOutputType,
  GenerationProviderLifecycle,
} from '@talelabs/flows'
import type { CatalogProviderBinding } from '@talelabs/models-catalog'

import type {
  PinnedGenerationProviderRoute,
  ResolvedGenerationProviderAdapter,
} from './contracts.js'

import {
  generationProviderLifecyclesEqual,
} from '@talelabs/flows'
import {
  createOpenRouterProviderAdapter,
  OPENROUTER_PROVIDER,
} from '@talelabs/openrouter'
import { createGenerationAssetResolver } from '../inputs/asset-resolver.js'
import { createDeterministicMockAdapter } from './mock/adapter.js'

/** Resolves one immutable job route to its provider implementation. */
export function resolveGenerationProviderAdapter(input: {
  adapterVersion: string
  catalogRevision: string
  catalogVersion: number
  executionMode: FlowRunExecutionMode
  modelContractVersion: string
  modelRevision: number
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
  providerBinding: CatalogProviderBinding
}): ResolvedGenerationProviderAdapter {
  const { executionMode, organizationId, ...pinnedRoute } = input
  const route = Object.freeze(pinnedRoute) satisfies Readonly<
    PinnedGenerationProviderRoute
  >
  const binding = route.providerBinding
  if (
    !route.catalogRevision
    || !route.catalogVersion
    || !route.modelRevision
    || !route.providerModel
    || !route.providerRouteVersion
    || binding.adapterVersion !== route.adapterVersion
    || binding.endpoint !== route.providerEndpoint
    || binding.nativeModelId !== route.providerModel
    || binding.operationId !== route.operationId
    || binding.provider !== route.provider
    || binding.providerTag !== route.providerEndpointTag
    || binding.routeVersion !== route.providerRouteVersion
    || !generationProviderLifecyclesEqual(
      route.providerLifecycle,
      binding.lifecycle,
    )
  ) {
    throw new Error('generation_provider_route_invalid')
  }
  if (executionMode === 'debug') {
    return {
      adapter: createDeterministicMockAdapter({ route }),
      requiresDurableSubmissionBoundary: false,
      route,
    }
  }
  if (route.provider === OPENROUTER_PROVIDER) {
    const resolveAsset = createGenerationAssetResolver(organizationId)
    const adapter = createOpenRouterProviderAdapter({
      binding,
      resolveAsset,
    })
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
        binding.requiresDurableSubmissionBoundary,
      route,
    }
  }
  throw new Error('generation_provider_adapter_unavailable')
}
