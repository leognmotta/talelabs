import type { GenerationProviderRoute } from '../contracts.js'

import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODELS,
  generationProviderLifecyclesEqual,
  getGenerationModel,
  validateGenerationProviderLifecycle,
} from '@talelabs/flows'
import {
  GENERATION_PROVIDER_ROUTES,
} from '../catalog.js'
import {
  LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION,
  OPENROUTER_PROVIDER,
  REVIEWED_AT,
} from '../contracts.js'
import {
  generationProviderRouteIdentity,
  generationProviderRouteKey,
} from './identity.js'
import {
  protocolForGenerationProviderRoute,
  requestProfileReferenceMaximum,
} from './protocol.js'

export function validateGenerationProviderRoutes(
  routes: readonly GenerationProviderRoute[] = GENERATION_PROVIDER_ROUTES,
) {
  const errors: string[] = []
  const keys = routes.map(generationProviderRouteIdentity)
  if (new Set(keys).size !== keys.length)
    errors.push('duplicate generation provider routes')

  const currentKeys = new Map<string, number>()
  for (const route of routes) {
    const key = generationProviderRouteKey(route)
    if (route.routingStatus === 'current')
      currentKeys.set(key, (currentKeys.get(key) ?? 0) + 1)
    if (
      route.routingStatus === 'current'
      && route.modelContractVersion !== GENERATION_MODEL_CONTRACT_VERSION
    ) {
      errors.push(`${key}: current route uses a historical model contract`)
    }
    const model = getGenerationModel(
      route.productModelId,
      route.modelContractVersion,
    )
    const operation = model?.operations.find(
      candidate => candidate.id === route.operationId,
    )
    const prefix = `${route.productModelId}/${route.operationId}`
    if (!model || !operation) {
      errors.push(`${prefix}: route does not resolve to a model operation`)
      continue
    }
    if (model.mediaType !== route.outputType)
      errors.push(`${prefix}: route output type is incompatible`)
    const profileSettings = [...route.requestProfile.settingIds].toSorted()
    const operationSettings = [...operation.settingIds].toSorted()
    if (JSON.stringify(profileSettings) !== JSON.stringify(operationSettings))
      errors.push(`${prefix}: request profile settings are incompatible`)
    if (
      (operation.referenceLimit?.maxItems ?? 0)
      !== requestProfileReferenceMaximum(route)
    ) {
      errors.push(`${prefix}: request profile reference limit is incompatible`)
    }
    const protocol = protocolForGenerationProviderRoute(route)
    if (
      !protocol
      || protocol.endpoint !== route.providerRoute.endpoint
      || protocol.kind !== route.requestProfile.kind
      || protocol.outputType !== route.outputType
      || !protocol.lifecycles.some(lifecycle => (
        generationProviderLifecyclesEqual(lifecycle, route.lifecycle)
      ))
    ) {
      errors.push(`${prefix}: route does not resolve to a compatible adapter`)
    }
    if (
      route.modelContractVersion === GENERATION_MODEL_CONTRACT_VERSION
      && route.adapterVersion === LEGACY_OPENROUTER_MEDIA_ADAPTER_VERSION
    ) {
      errors.push(`${prefix}: current routes must use a protocol adapter`)
    }
    errors.push(...validateGenerationProviderLifecycle(route.lifecycle).map(
      error => `${prefix}: ${error}`,
    ))
    if (
      route.provider !== OPENROUTER_PROVIDER
      || route.providerRoute.provider !== OPENROUTER_PROVIDER
      || route.providerRoute.policy !== 'pinned'
      || !route.providerRoute.nativeModelId
      || !route.providerRoute.providerTag
      || !route.providerRoute.supportedParameters.length
    ) {
      errors.push(`${prefix}: provider route identity is incomplete`)
    }
    if (
      route.evidence.reviewedAt !== REVIEWED_AT
      || route.evidence.sources.some((source) => {
        try {
          return new URL(source).protocol !== 'https:'
        }
        catch {
          return true
        }
      })
    ) {
      errors.push(`${prefix}: route evidence is invalid`)
    }
  }

  for (const model of GENERATION_MODELS) {
    for (const operation of model.operations) {
      const key = generationProviderRouteKey({
        modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
        operationId: operation.id,
        productModelId: model.id,
      })
      if (currentKeys.get(key) !== 1)
        errors.push(`${model.id}/${operation.id}: expected exactly one current route`)
    }
  }

  const currentCatalogKeys = new Set(GENERATION_MODELS.flatMap(model =>
    model.operations.map(operation => generationProviderRouteKey({
      modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
      operationId: operation.id,
      productModelId: model.id,
    })),
  ))
  for (const key of currentKeys.keys()) {
    if (!currentCatalogKeys.has(key))
      errors.push(`${key}: current route is not in the active catalog`)
  }
  return errors
}

export function assertGenerationProviderRoutes() {
  const errors = validateGenerationProviderRoutes()
  if (errors.length) {
    throw new Error(
      `Invalid generation provider routes:\n${errors.join('\n')}`,
    )
  }
}
