import type {
  GenerationModelDefinition,
  GenerationNodeType,
  GenerationOutputType,
} from '../types.js'

import { areGenerationModelContractsEquivalent } from '../../resolution/model-compatibility.js'
import { GENERATION_MODELS } from '../contracts.js'
import { getGenerationModel } from './lookup.js'

export function isCurrentGenerationModelContract(
  modelId: string,
  contractVersion: unknown,
) {
  return areGenerationModelContractsEquivalent(modelId, contractVersion)
}

export function getImageGenerationModel(modelId: string) {
  const model = getGenerationModel(modelId)
  return model?.mediaType === 'image' ? model : undefined
}

export function getGenerationModels(mediaType: GenerationOutputType) {
  return GENERATION_MODELS.filter(model => model.mediaType === mediaType)
}

export const LEGACY_NODE_TYPE_BY_MEDIA: Partial<
  Record<GenerationOutputType, Exclude<GenerationNodeType, 'audioGeneration'>>
> = {
  image: 'imageGeneration',
  text: 'llm',
  video: 'videoGeneration',
}

export type GenerationModelQueryInput = GenerationModelDefinition
