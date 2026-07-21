/** Current fal catalog binding fixtures and immutable route projections. */

import type {
  CatalogFalProviderBinding,
  CatalogModelRecord,
  CatalogOperation,
} from '@talelabs/models-catalog'
import type { PinnedGenerationProviderRoute } from '../../src/generation/adapters/contracts.js'

import {
  GENERATION_CATALOG_REVISION,
  GENERATION_MODEL_CONTRACT_VERSION,
} from '@talelabs/flows'
import {
  MODEL_CATALOG,
  MODEL_CATALOG_MODELS,
} from '@talelabs/models-catalog'

/** One current model operation paired with its immutable fal binding. */
export interface FalCatalogRouteFixture {
  /** Reviewed private fal execution binding. */
  binding: CatalogFalProviderBinding
  /** Current owning creative model. */
  model: CatalogModelRecord
  /** Provider-neutral operation served by the binding. */
  operation: CatalogOperation
}

/** Enumerates every fal catalog binding with its owning operation. */
export function currentFalRoutes(): FalCatalogRouteFixture[] {
  return MODEL_CATALOG_MODELS.flatMap(model => model.bindings
    .filter((binding): binding is CatalogFalProviderBinding =>
      binding.provider === 'fal',
    )
    .map((binding) => {
      const operation = model.operations.find(candidate =>
        candidate.id === binding.operationId,
      )
      if (!operation) {
        throw new Error(
          `Catalog binding ${model.id}/${binding.operationId} does not resolve to an operation`,
        )
      }
      return { binding, model, operation }
    }))
}

/** Projects one fal fixture into the exact route captured by admission. */
export function pinnedFalRoute(
  route: FalCatalogRouteFixture,
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
