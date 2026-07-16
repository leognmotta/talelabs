/**
 * Private provider-binding lookup for run admission.
 *
 * Workers must execute the resolved binding captured in an immutable run
 * snapshot; they must not call this lookup again during retries.
 *
 */

import { getCatalogModel } from './catalog.js'

/**
 * Lists provider bindings for one current model operation in priority order.
 *
 * @param modelId - Canonical `vendor/model` identity.
 * @param operationId - Stable provider-neutral operation ID.
 * @returns Immutable bindings ordered from highest to lowest priority.
 */
export function getCatalogProviderBindings(
  modelId: string,
  operationId: string,
) {
  const model = getCatalogModel(modelId)
  return Object.freeze((model?.bindings ?? [])
    .filter(binding => binding.operationId === operationId)
    .toSorted((left, right) => right.priority - left.priority))
}

/**
 * Resolves the preferred provider binding used for new run admission.
 *
 * @param modelId - Canonical `vendor/model` identity.
 * @param operationId - Stable provider-neutral operation ID.
 * @returns The highest-priority binding, or `undefined` when unsupported.
 */
export function getCatalogProviderBinding(
  modelId: string,
  operationId: string,
) {
  return getCatalogProviderBindings(modelId, operationId)[0]
}
