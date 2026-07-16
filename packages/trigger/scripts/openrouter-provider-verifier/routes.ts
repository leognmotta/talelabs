import type { GenerationProviderRoute } from '@talelabs/openrouter'
import type { PinnedGenerationProviderRoute } from '../../src/generation/adapters/contracts.js'

import assert from 'node:assert/strict'
import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_REGISTRY_VERSION,
  getGenerationModel,
} from '@talelabs/flows'
import { getGenerationProviderRoute } from '@talelabs/openrouter'

export function pinnedRoute(
  route: GenerationProviderRoute,
): Readonly<PinnedGenerationProviderRoute> {
  return Object.freeze({
    adapterVersion: route.adapterVersion,
    modelContractVersion: route.modelContractVersion,
    modelRegistryVersion: GENERATION_REGISTRY_VERSION,
    operationId: route.operationId,
    outputType: route.outputType,
    productModelId: route.productModelId,
    provider: route.provider,
    providerEndpoint: route.providerRoute.endpoint,
    providerEndpointTag: route.providerRoute.providerTag,
    providerLifecycle: route.lifecycle,
    providerModel: route.providerRoute.nativeModelId,
    providerRouteVersion: route.routeVersion,
  })
}

export function currentRoute(productModelId: string, operationId: string) {
  const route = getGenerationProviderRoute({
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    operationId,
    productModelId,
  })
  assert.ok(route)
  return route
}

export function defaultSettings(route: GenerationProviderRoute) {
  const model = getGenerationModel(
    route.productModelId,
    route.modelContractVersion,
  )
  const operation = model?.operations.find(
    candidate => candidate.id === route.operationId,
  )
  assert.ok(model)
  assert.ok(operation)
  return Object.fromEntries(operation.settingIds.map((settingId) => {
    const setting = model.settings.find(candidate => candidate.id === settingId)
    assert.ok(setting)
    return [settingId, setting.default]
  }))
}
