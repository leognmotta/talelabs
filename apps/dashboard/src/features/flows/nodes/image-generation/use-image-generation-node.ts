/** Narrow canvas and server-state controller for one image-generation node. */

import type {
  GenerationInputSlotDefinition,
  GenerationSettingValue,
  PromptTemplate,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../editor/flow-canvas-types'

import {
  getActiveGenerationSettings,
  resolveImageGenerationState,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useGenerationModelTransition } from '../shared/generation-node/use-generation-model-transition'
import {
  generationInlineValue,
  useGenerationNodeController,
} from '../shared/generation-node/use-generation-node-controller'
import {
  IMAGE_GENERATION_SEMANTIC_SLOT_IDS,
  resolveImageGenerationModelConfiguration,
} from './image-generation-model-configuration'

/** Resolves one image-generation node and binds its model/settings canvas actions. */
export function useImageGenerationNode(input: {
  incomingConnections: readonly NodeConnection[]
  node: Pick<CanvasNode, 'data' | 'id' | 'type'>
}) {
  const {
    canvas,
    canUpgradeModelContract,
    configModels,
    connectionCounts,
    model,
    modelOptions,
    promptInputs,
    promptReferencesValid,
    slots,
  } = useGenerationNodeController({
    ...input,
    scope: {
      categoryId: 'image',
      categoryLabelKey: 'assets.types.image',
      kind: 'mediaType',
      mediaType: 'image',
    },
  })
  const semanticSlots = useMemo(
    () => slots.filter(slot => IMAGE_GENERATION_SEMANTIC_SLOT_IDS.has(slot.id)),
    [slots],
  )
  const itemCounts = Object.fromEntries(
    semanticSlots.map((slot) => {
      return [
        slot.id,
        canvas.getExecutableInputCount(input.node.id, slot.id),
      ]
    }),
  )
  const inlinePrompt = generationInlineValue({
    connectionCounts,
    data: input.node.data,
    slotId: 'prompt',
  })
  const resolution = model
    ? resolveImageGenerationState({
        connectionCounts,
        inlinePrompt,
        itemCounts,
        model,
        settings: input.node.data.settings ?? {},
      })
    : null
  const visibleSettingIds = new Set(resolution?.visibleSettingIds ?? [])
  const activeSettings
    = model && resolution?.resolvedOperationId
      ? getActiveGenerationSettings(
          model,
          resolution.resolvedOperationId,
        ).filter(setting => visibleSettingIds.has(setting.id))
      : []
  const { requestModelChange, upgradeModelContract }
    = useGenerationModelTransition({
      applyConfiguration: canvas.updateGenerationConfiguration,
      configModels,
      currentContractVersion: input.node.data.modelContractVersion,
      currentModel: model,
      nodeId: input.node.id,
      resolveConfiguration: (targetModel, targetContractVersion) =>
        resolveImageGenerationModelConfiguration({
          connectionCounts,
          getExecutableInputCount: (nodeId, slotId) =>
            canvas.getExecutableInputCount(nodeId, slotId),
          node: input.node,
          targetContractVersion,
          targetModel,
        }),
    })

  function updateSetting(settingId: string, value: GenerationSettingValue) {
    if (!model || !resolution)
      return
    const next = resolveImageGenerationState({
      connectionCounts,
      inlinePrompt: generationInlineValue({
        connectionCounts,
        data: input.node.data,
        slotId: 'prompt',
      }),
      itemCounts,
      model,
      settings: { ...input.node.data.settings, [settingId]: value },
    })
    canvas.updateNodeData(input.node.id, current => ({
      ...current,
      operationId: next.resolvedOperationId ?? current.operationId,
      settings: next.normalizedSettings,
    }))
  }

  function inputState(slot: GenerationInputSlotDefinition) {
    return canvas.getInputState(input.node.id, slot.id)
  }

  return {
    activeSettings,
    canUpgradeModelContract,
    externalPromptConnected: (connectionCounts.prompt ?? 0) > 0,
    inputState,
    model,
    modelOptions,
    promptInputs,
    promptReferencesValid,
    requestModelChange,
    resolution,
    semanticSlots,
    updatePrompt: (prompt: PromptTemplate) =>
      canvas.updateNodeData(input.node.id, current => ({
        ...current,
        prompt,
      })),
    updateSetting,
    upgradeModelContract,
  }
}
