/** Model-transition configuration for image generation nodes and legacy slot aliases. */

import type { GenerationModelDefinition } from '@talelabs/flows'
import type { CanvasNode } from '../../editor/flow-canvas-types'

import {
  normalizeImageGenerationInputSlotId,
  resolveImageGenerationState,
} from '@talelabs/flows'
import {
  generationInlineValue,
  generationInputContracts,
} from '../shared/generation-node/use-generation-node-controller'

/** Semantic image-generation slots retained across the legacy reference alias. */
export const IMAGE_GENERATION_SEMANTIC_SLOT_IDS = new Set([
  'prompt',
  'references',
  'imageReferences',
])

function getTargetImageInputCounts(input: {
  connectionCounts: Readonly<Record<string, number>>
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  nodeId: string
  targetModel: GenerationModelDefinition
}) {
  const counts: Record<string, number> = {}
  const items: Record<string, number> = {}
  for (const slot of input.targetModel.inputSlots) {
    const legacySlotId = slot.id === 'imageReferences' ? 'references' : slot.id
    counts[slot.id] = Math.max(
      input.connectionCounts[slot.id] ?? 0,
      input.connectionCounts[legacySlotId] ?? 0,
    )
    items[slot.id]
      = input.getExecutableInputCount(input.nodeId, slot.id)
        || input.getExecutableInputCount(input.nodeId, legacySlotId)
  }
  return { counts, items }
}

/** Reconciles image inputs, aliases, operation, and settings for a new model. */
export function resolveImageGenerationModelConfiguration(input: {
  connectionCounts: Readonly<Record<string, number>>
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  node: Pick<CanvasNode, 'data' | 'id'>
  targetContractVersion: string
  targetModel: GenerationModelDefinition
}) {
  const target = getTargetImageInputCounts({
    connectionCounts: input.connectionCounts,
    getExecutableInputCount: input.getExecutableInputCount,
    nodeId: input.node.id,
    targetModel: input.targetModel,
  })
  const targetResolution = resolveImageGenerationState({
    connectionCounts: target.counts,
    inlinePrompt: generationInlineValue({
      connectionCounts: input.connectionCounts,
      data: input.node.data,
      slotId: 'prompt',
    }),
    itemCounts: target.items,
    model: input.targetModel,
    settings: input.node.data.settings ?? {},
  })
  const contracts = generationInputContracts({
    model: input.targetModel,
    normalizeSlotId: slotId => normalizeImageGenerationInputSlotId(slotId),
    slots: input.targetModel.inputSlots.filter(slot => (
      IMAGE_GENERATION_SEMANTIC_SLOT_IDS.has(slot.id)
    )),
  })
  return {
    activeInputContracts: contracts,
    inputHandleAliases: { references: 'imageReferences' },
    inputMaximums: Object.fromEntries(
      input.targetModel.inputSlots.map(slot => [slot.id, slot.maxItems]),
    ),
    inputSlotIds: input.targetModel.inputSlots
      .filter(slot => IMAGE_GENERATION_SEMANTIC_SLOT_IDS.has(slot.id))
      .map(slot => normalizeImageGenerationInputSlotId(slot.id)),
    modelContractVersion: input.targetContractVersion,
    modelId: input.targetModel.id,
    operationId:
      targetResolution.resolvedOperationId
      ?? input.targetModel.defaultOperationId,
    settings: targetResolution.normalizedSettings,
  }
}
