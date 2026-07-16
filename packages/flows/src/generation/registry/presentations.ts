/**
 * Public presentation lookup backed by the checked-in model catalog.
 *
 */

import type { GenerationModelPresentationDefinition } from './types.js'

import { getCatalogModel } from '@talelabs/models-catalog'

/**
 * Resolves public presentation metadata for one canonical model identity.
 *
 * @param modelId - Canonical `vendor/model` identity.
 * @returns Sanitized presentation metadata, or `undefined` when unknown.
 */
export function getGenerationModelPresentation(
  modelId: string,
): GenerationModelPresentationDefinition | undefined {
  return getCatalogModel(modelId)?.presentation as
    | GenerationModelPresentationDefinition
    | undefined
}
