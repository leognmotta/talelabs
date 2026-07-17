/** Model-transition configuration for video generation nodes. */

import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { CanvasNode } from '../../editor/flow-canvas-types'

import {
  applyGenerationSettingRequirements,
  isGenerationSettingValueValid,
  resolveVideoGenerationState,
} from '@talelabs/flows'
import {
  generationInlineValue,
  generationInputContracts,
} from '../shared/generation-node/use-generation-node-controller'

function normalizeVideoGenerationSettings(input: {
  connectionCounts: Readonly<Record<string, number>>
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  node: Pick<CanvasNode, 'data' | 'id'>
  targetModel: GenerationModelDefinition
}) {
  const settings = Object.fromEntries(
    input.targetModel.settings.map((setting) => {
      const existing = input.node.data.settings?.[setting.id]
      return [
        setting.id,
        existing !== undefined
        && isGenerationSettingValueValid(setting, existing)
          ? existing
          : setting.default,
      ]
    }),
  ) as Record<string, GenerationSettingValue>
  const targetCounts = Object.fromEntries(
    input.targetModel.inputSlots.map(slot => [
      slot.id,
      input.connectionCounts[slot.id] ?? 0,
    ]),
  )
  const targetItems = Object.fromEntries(
    input.targetModel.inputSlots.map(slot => [
      slot.id,
      input.getExecutableInputCount(input.node.id, slot.id),
    ]),
  )
  const targetResolution = resolveVideoGenerationState({
    connectionCounts: targetCounts,
    inlinePrompt: generationInlineValue({
      connectionCounts: input.connectionCounts,
      data: input.node.data,
      slotId: 'prompt',
    }),
    itemCounts: targetItems,
    model: input.targetModel,
    settings,
  })
  return applyGenerationSettingRequirements({
    connectedSlotIds: new Set(
      Object.entries(targetCounts)
        .filter(([, count]) => count > 0)
        .map(([slotId]) => slotId),
    ),
    model: input.targetModel,
    operationId:
      targetResolution.resolvedOperationId
      ?? input.targetModel.defaultOperationId,
    settings,
  })
}

/** Reconciles video inputs, operation defaults, and settings for a new model. */
export function resolveVideoGenerationModelConfiguration(input: {
  connectionCounts: Readonly<Record<string, number>>
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  node: Pick<CanvasNode, 'data' | 'id'>
  targetContractVersion: string
  targetModel: GenerationModelDefinition
}) {
  const settings = normalizeVideoGenerationSettings(input)
  return {
    activeInputContracts: generationInputContracts({
      model: input.targetModel,
    }),
    inputSlotIds: input.targetModel.inputSlots.map(slot => slot.id),
    modelContractVersion: input.targetContractVersion,
    modelId: input.targetModel.id,
    operationId: input.targetModel.defaultOperationId,
    settings,
  }
}
