import type {
  GenerationModelDefinition,
  GenerationNodeType,
} from '../types.js'

import { GENERATION_MODELS } from '../contracts.js'
import { LEGACY_NODE_TYPE_BY_MEDIA } from './models.js'

export function getGenerationOperationsForNodeType(
  model: GenerationModelDefinition,
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  return model.operations.filter(operation =>
    operation.nodeType === nodeType
    || (operation.nodeType === undefined
      && LEGACY_NODE_TYPE_BY_MEDIA[model.mediaType] === nodeType),
  )
}

export function getGenerationModelsForNodeType(
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  return GENERATION_MODELS.filter(model =>
    getGenerationOperationsForNodeType(model, nodeType).length > 0,
  )
}

export function getGenerationInputSlotsForNodeType(
  model: GenerationModelDefinition,
  nodeType: Exclude<GenerationNodeType, 'audioGeneration'>,
) {
  const slotIds = new Set(
    getGenerationOperationsForNodeType(model, nodeType).flatMap(
      operation => operation.inputSlotIds,
    ),
  )
  return model.inputSlots.filter(slot => slotIds.has(slot.id))
}
