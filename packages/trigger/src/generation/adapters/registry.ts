/** Provider registry resolving captured bindings without reshaping requests. */

import type {
  FlowRunExecutionMode,
  GenerationOutputType,
  GenerationProviderLifecycle,
} from '@talelabs/flows'
import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type { ProviderRuntimeCredential } from '@talelabs/providers/server'

import type {
  PinnedGenerationProviderRoute,
  ResolvedGenerationProviderAdapter,
} from './contracts.js'

import {
  generationProviderLifecyclesEqual,
} from '@talelabs/flows'
import {
  createProviderAdapter,
} from '@talelabs/providers/server'
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
  runtimeCredential?: ProviderRuntimeCredential
}): ResolvedGenerationProviderAdapter {
  const {
    executionMode,
    organizationId,
    runtimeCredential,
    ...pinnedRoute
  } = input
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
  const registered = createProviderAdapter({
    binding,
    credential: runtimeCredential,
    resolveAsset: createGenerationAssetResolver(organizationId),
  })
  if (!generationProviderLifecyclesEqual(
    route.providerLifecycle,
    registered.adapter.lifecycle,
  )) {
    throw new Error('generation_provider_route_invalid')
  }
  return {
    adapter: registered.adapter,
    requiresDurableSubmissionBoundary:
      registered.requiresDurableSubmissionBoundary,
    route,
  }
}
