/** Model-transition configuration for intent-specific audio generation nodes. */

import type {
  AudioIntentNodeType,
  GenerationModelDefinition,
} from '@talelabs/flows'
import type { CanvasNode } from '../../editor/flow-canvas-types'

import {
  getGenerationInputSlotsForNodeType,
  getGenerationOperationsForNodeType,
  reconcileAudioNodeModel,
} from '@talelabs/flows'
import {
  generationInlineValue,
  generationInputContracts,
} from '../shared/generation-node/use-generation-node-controller'

/** Reconciles one audio node against a newly selected catalog model contract. */
export function resolveAudioModelConfiguration(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  nodeData: CanvasNode['data']
  nodeType: AudioIntentNodeType
  targetContractVersion: string
  targetModel: GenerationModelDefinition
}) {
  const targetOperation = getGenerationOperationsForNodeType(
    input.targetModel,
    input.nodeType,
  )[0]
  if (!targetOperation)
    return null
  const reconciled = reconcileAudioNodeModel(input.nodeType, {
    connectionCounts: input.connectionCounts,
    inlineLyrics: generationInlineValue({
      connectionCounts: input.connectionCounts,
      data: input.nodeData,
      slotId: 'lyrics',
    }),
    inlinePrompt: generationInlineValue({
      connectionCounts: input.connectionCounts,
      data: input.nodeData,
      slotId: 'prompt',
    }),
    itemCounts: input.itemCounts,
    model: input.targetModel,
    settings: input.nodeData.settings ?? {},
  })
  const targetSlots = getGenerationInputSlotsForNodeType(
    input.targetModel,
    input.nodeType,
  )
  return {
    activeInputContracts: generationInputContracts({
      model: input.targetModel,
      operations: getGenerationOperationsForNodeType(
        input.targetModel,
        input.nodeType,
      ),
      slots: targetSlots,
    }),
    inputMaximums: Object.fromEntries(
      targetSlots.map(slot => [slot.id, slot.maxItems]),
    ),
    inputSlotIds: targetSlots.map(slot => slot.id),
    modelContractVersion: input.targetContractVersion,
    modelId: input.targetModel.id,
    operationId:
      reconciled.resolution.resolvedOperationId ?? targetOperation.id,
    settings: reconciled.settings,
  }
}
