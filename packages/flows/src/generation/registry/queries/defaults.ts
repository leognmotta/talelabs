/** Default persisted node data derived from the canonical generation registry. */

import type {
  GenerationNodeType,
  GenerationOutputType,
} from '../types.js'

import { promptTemplateFromText } from '../../../prompts/schema.js'
import {
  DEFAULT_GENERATION_MODEL_IDS,
  DEFAULT_GENERATION_MODEL_IDS_BY_NODE,
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODEL_REGISTRY,
} from '../contracts.js'
import {
  getGenerationInputSlotsForNodeType,
  getGenerationOperationsForNodeType,
} from './nodes.js'

function emptyPromptTemplate() {
  return promptTemplateFromText('')
}

/** Builds current default data for the legacy media-family node entrypoint. */
export function getDefaultGenerationData(mediaType: GenerationOutputType) {
  const model
    = GENERATION_MODEL_REGISTRY[DEFAULT_GENERATION_MODEL_IDS[mediaType]]
  return {
    inputSelections: Object.fromEntries(
      model.inputSlots.map(slot => [slot.id, { mode: 'auto' as const }]),
    ),
    ...(mediaType === 'image' || mediaType === 'video'
      ? { prompt: emptyPromptTemplate() }
      : {}),
    ...(mediaType === 'text'
      ? { instructions: '', prompt: emptyPromptTemplate() }
      : {}),
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    modelId: model.id,
    operationId: model.defaultOperationId,
    settings: Object.fromEntries(
      model.settings.map(setting => [setting.id, setting.default]),
    ),
  }
}

/** Builds current default data for one model-adaptive generation node family. */
export function getDefaultGenerationDataForNodeType(
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  const modelId = DEFAULT_GENERATION_MODEL_IDS_BY_NODE[nodeType]
  if (!modelId)
    throw new Error(`No current generation model for ${nodeType}`)
  const model = GENERATION_MODEL_REGISTRY[modelId]
  const operation = getGenerationOperationsForNodeType(model, nodeType)[0]
  if (!operation)
    throw new Error(`No default generation operation for ${nodeType}`)
  return {
    inputSelections: Object.fromEntries(
      getGenerationInputSlotsForNodeType(model, nodeType).map(slot => [
        slot.id,
        { mode: 'auto' as const },
      ]),
    ),
    ...(nodeType === 'imageGeneration' || nodeType === 'videoGeneration'
      ? { prompt: emptyPromptTemplate() }
      : {}),
    ...(nodeType === 'llm'
      ? { instructions: '', prompt: emptyPromptTemplate() }
      : {}),
    ...(nodeType === 'musicGeneration'
      ? { lyrics: '', prompt: emptyPromptTemplate() }
      : {}),
    ...(nodeType === 'soundEffectGeneration' || nodeType === 'speechGeneration'
      ? { prompt: emptyPromptTemplate() }
      : {}),
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    modelId: model.id,
    operationId: operation.id,
    settings: Object.fromEntries(
      model.settings.map(setting => [setting.id, setting.default]),
    ),
  }
}

/** Builds the current image-generation defaults. */
export function getDefaultImageGenerationData() {
  return getDefaultGenerationData('image')
}
