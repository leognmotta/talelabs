/** Production catalog binding fixtures and immutable route projections. */

import type {
  CatalogModelRecord,
  CatalogOperation,
  CatalogProviderBinding,
} from '@talelabs/models-catalog'
import type { PinnedGenerationProviderRoute } from '../../src/generation/adapters/contracts.js'

import assert from 'node:assert/strict'
import {
  GENERATION_CATALOG_REVISION,
  GENERATION_MODEL_CONTRACT_VERSION,
} from '@talelabs/flows'
import {
  getCatalogModel,
  MODEL_CATALOG,
  MODEL_CATALOG_MODELS,
} from '@talelabs/models-catalog'

/** One current model operation paired with its immutable provider binding. */
export interface CatalogRouteFixture {
  binding: CatalogProviderBinding
  model: CatalogModelRecord
  operation: CatalogOperation
}

/** Enumerates every production catalog binding with its owning operation. */
export function currentRoutes(): CatalogRouteFixture[] {
  return MODEL_CATALOG_MODELS.flatMap(model => model.bindings.map((binding) => {
    const operation = model.operations.find(candidate =>
      candidate.id === binding.operationId,
    )
    assert.ok(operation)
    return { binding, model, operation }
  }))
}

/** Projects one catalog fixture into the exact route captured by admission. */
export function pinnedRoute(
  route: CatalogRouteFixture,
): Readonly<PinnedGenerationProviderRoute> {
  return Object.freeze({
    adapterVersion: route.binding.adapterVersion,
    catalogRevision: GENERATION_CATALOG_REVISION,
    catalogVersion: MODEL_CATALOG.catalogVersion,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    modelRevision: route.model.revision,
    operationId: route.operation.id,
    outputType: route.model.mediaType,
    productModelId: route.model.id,
    provider: route.binding.provider,
    providerBinding: route.binding,
    providerEndpoint: route.binding.endpoint,
    providerEndpointTag: route.binding.providerTag,
    providerLifecycle: route.binding.lifecycle,
    providerModel: route.binding.nativeModelId,
    providerRouteVersion: route.binding.routeVersion,
  })
}

/** Resolves one required current fixture by canonical model and operation. */
export function currentRoute(productModelId: string, operationId: string) {
  const model = getCatalogModel(productModelId)
  const operation = model?.operations.find(candidate => candidate.id === operationId)
  const binding = model?.bindings.find(candidate => candidate.operationId === operationId)
  assert.ok(model)
  assert.ok(operation)
  assert.ok(binding)
  return { binding, model, operation }
}
