import type {
  GenerationModelContractVersion,
  GenerationModelId,
  ImageGenerationModelId,
} from '../contracts.js'

import type { GenerationModelDefinition } from '../types.js'
import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODEL_CONTRACTS,
  GENERATION_MODEL_REGISTRY,
} from '../contracts.js'

export function isGenerationModelId(
  value: unknown,
): value is GenerationModelId {
  return typeof value === 'string' && value in GENERATION_MODEL_REGISTRY
}

export function isImageGenerationModelId(
  value: unknown,
): value is ImageGenerationModelId {
  return isGenerationModelId(value)
    && GENERATION_MODEL_REGISTRY[value].mediaType === 'image'
}

export function getGenerationModel(
  modelId: string,
  contractVersion: unknown = GENERATION_MODEL_CONTRACT_VERSION,
): GenerationModelDefinition | undefined {
  const registry:
    | Readonly<Record<string, GenerationModelDefinition>>
    | undefined = typeof contractVersion === 'string'
      && contractVersion in GENERATION_MODEL_CONTRACTS
      ? GENERATION_MODEL_CONTRACTS[
        contractVersion as GenerationModelContractVersion
      ]
      : undefined
  return registry?.[modelId]
}
