/** LLM model-transition normalization and input compatibility projection. */

import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../editor/flow-canvas-types'
import type { GenerationConfigurationUpdate } from '../../generation/flow-generation-configuration'
import type { GenerationNodeCanvas } from '../shared/generation-node/use-generation-node-controller'

import {
  isGenerationSettingValueValid,
  resolveLlmState,
} from '@talelabs/flows'
import {
  generationInlineValue,
  generationInputContracts,
} from '../shared/generation-node/use-generation-node-controller'

/** Normalizes saved LLM settings against one target model contract. */
export function llmTargetSettings(
  node: Pick<CanvasNode, 'data'>,
  targetModel: GenerationModelDefinition,
) {
  return Object.fromEntries(targetModel.settings.map((setting) => {
    const saved = node.data.settings?.[setting.id]
    return [
      setting.id,
      saved !== undefined && isGenerationSettingValueValid(setting, saved)
        ? saved
        : setting.default,
    ]
  })) as Record<string, GenerationSettingValue>
}

/** Resolves an atomic LLM model transition from compatible current inputs. */
export function resolveLlmModelConfiguration(
  context: {
    canvas: GenerationNodeCanvas
    incomingConnections: readonly NodeConnection[]
    node: Pick<CanvasNode, 'data' | 'id'>
  },
  targetModel: GenerationModelDefinition,
  targetContractVersion: string,
): GenerationConfigurationUpdate {
  const { canvas, incomingConnections, node } = context
  const targetInputSlots = targetModel.inputSlots.filter(
    slot => slot.id !== 'instructions',
  )
  const compatibleEdgeIds = new Set(
    canvas.getIncompatibleGenerationEdges(
      node.id,
      generationInputContracts({
        model: targetModel,
        slots: targetInputSlots,
      }),
    ).map(edge => edge.id),
  )
  const targetCounts: Record<string, number> = {}
  for (const connection of incomingConnections) {
    if (connection.edgeId && compatibleEdgeIds.has(connection.edgeId))
      continue
    if (
      connection.targetHandle
      && targetInputSlots.some(slot => slot.id === connection.targetHandle)
    ) {
      targetCounts[connection.targetHandle]
        = (targetCounts[connection.targetHandle] ?? 0) + 1
    }
  }
  const targetItems = Object.fromEntries(
    targetInputSlots.map(slot => [
      slot.id,
      canvas.getExecutableInputCount(node.id, slot.id),
    ]),
  )
  const next = resolveLlmState({
    connectionCounts: targetCounts,
    inlineInstructions: String(node.data.instructions ?? ''),
    inlinePrompt: generationInlineValue({
      connectionCounts: targetCounts,
      data: node.data,
      slotId: 'prompt',
    }),
    itemCounts: targetItems,
    model: targetModel,
    settings: llmTargetSettings(node, targetModel),
  })
  return {
    activeInputContracts: generationInputContracts({
      model: targetModel,
      slots: targetInputSlots,
    }),
    inputMaximums: Object.fromEntries(
      targetInputSlots.map(slot => [slot.id, slot.maxItems]),
    ),
    inputSlotIds: targetInputSlots.map(slot => slot.id),
    modelContractVersion: targetContractVersion,
    modelId: targetModel.id,
    operationId: next.resolvedOperationId ?? targetModel.defaultOperationId,
    settings: next.normalizedSettings,
  }
}
