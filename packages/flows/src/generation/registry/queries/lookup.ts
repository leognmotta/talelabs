/**
 * Current model identity and contract lookup for Flow readers.
 *
 */

import type {
  GenerationModelId,
  ImageGenerationModelId,
} from '../contracts.js'
import type { GenerationModelDefinition } from '../types.js'

import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODEL_REGISTRY,
} from '../contracts.js'

/** Returns whether a value is a current canonical model identity. */
export function isGenerationModelId(
  value: unknown,
): value is GenerationModelId {
  return typeof value === 'string' && value in GENERATION_MODEL_REGISTRY
}

/** Returns whether a value is a current canonical image-model identity. */
export function isImageGenerationModelId(
  value: unknown,
): value is ImageGenerationModelId {
  return isGenerationModelId(value)
    && GENERATION_MODEL_REGISTRY[value].mediaType === 'image'
}

/**
 * Resolves a current provider-neutral model contract.
 *
 * Development-only historical registries were removed before production;
 * immutable runs carry their complete execution facts instead.
 */
export function getGenerationModel(
  modelId: string,
  contractVersion: unknown = GENERATION_MODEL_CONTRACT_VERSION,
): GenerationModelDefinition | undefined {
  return contractVersion === GENERATION_MODEL_CONTRACT_VERSION
    ? GENERATION_MODEL_REGISTRY[modelId]
    : undefined
}
