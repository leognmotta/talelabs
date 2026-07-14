import type {
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import {
  getActiveGenerationSettings,
  normalizeImageGenerationInputSlotId,
  resolveImageGenerationState,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useGenerationModelTransition } from '../use-generation-model-transition'
import {
  generationInlineValue,
  generationInputContracts,
  useGenerationNodeController,
} from '../use-generation-node-controller'

const IMAGE_SLOT_IDS = new Set(['prompt', 'references', 'imageReferences'])

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
    () => slots.filter(slot => IMAGE_SLOT_IDS.has(slot.id)),
    [slots],
  )
  const itemCounts = useMemo(
    () =>
      Object.fromEntries(
        semanticSlots.map((slot) => {
          return [
            slot.id,
            canvas.getExecutableInputCount(input.node.id, slot.id),
          ]
        }),
      ),
    [canvas, input.node.id, semanticSlots],
  )
  const inlinePrompt = generationInlineValue({
    connectionCounts,
    data: input.node.data,
    slotId: 'prompt',
  })
  const resolution = useMemo(
    () =>
      model
        ? resolveImageGenerationState({
            connectionCounts,
            inlinePrompt,
            itemCounts,
            model,
            settings: input.node.data.settings ?? {},
          })
        : null,
    [
      connectionCounts,
      input.node.data.settings,
      inlinePrompt,
      itemCounts,
      model,
    ],
  )
  const visibleSettingIds = new Set(resolution?.visibleSettingIds ?? [])
  const activeSettings
    = model && resolution?.resolvedOperationId
      ? getActiveGenerationSettings(
          model,
          resolution.resolvedOperationId,
        ).filter(
          setting =>
            setting.id !== 'outputCount'
            && visibleSettingIds.has(setting.id),
        )
      : []
  function targetCounts(targetModel: GenerationModelDefinition) {
    const counts: Record<string, number> = {}
    const items: Record<string, number> = {}
    for (const slot of targetModel.inputSlots) {
      const legacySlotId
        = slot.id === 'imageReferences' ? 'references' : slot.id
      counts[slot.id] = Math.max(
        connectionCounts[slot.id] ?? 0,
        connectionCounts[legacySlotId] ?? 0,
      )
      items[slot.id]
        = canvas.getExecutableInputCount(input.node.id, slot.id)
          || canvas.getExecutableInputCount(input.node.id, legacySlotId)
    }
    return { counts, items }
  }

  function resolveModelConfiguration(
    targetModel: GenerationModelDefinition,
    targetContractVersion: string,
  ) {
    const target = targetCounts(targetModel)
    const targetResolution = resolveImageGenerationState({
      connectionCounts: target.counts,
      inlinePrompt: generationInlineValue({
        connectionCounts,
        data: input.node.data,
        slotId: 'prompt',
      }),
      itemCounts: target.items,
      model: targetModel,
      settings: input.node.data.settings ?? {},
    })
    const contracts = generationInputContracts({
      model: targetModel,
      normalizeSlotId: slotId => normalizeImageGenerationInputSlotId(slotId),
      slots: targetModel.inputSlots.filter(slot => IMAGE_SLOT_IDS.has(slot.id)),
    })
    return {
      activeInputContracts: contracts,
      inputHandleAliases: { references: 'imageReferences' },
      inputMaximums: Object.fromEntries(
        targetModel.inputSlots.map(slot => [slot.id, slot.maxItems]),
      ),
      inputSlotIds: targetModel.inputSlots
        .filter(slot => IMAGE_SLOT_IDS.has(slot.id))
        .map(slot => normalizeImageGenerationInputSlotId(slot.id)),
      modelContractVersion: targetContractVersion,
      modelId: targetModel.id,
      operationId:
        targetResolution.resolvedOperationId ?? targetModel.defaultOperationId,
      settings: targetResolution.normalizedSettings,
    }
  }

  const { requestModelChange, upgradeModelContract }
    = useGenerationModelTransition({
      applyConfiguration: canvas.updateGenerationConfiguration,
      configModels,
      currentContractVersion: input.node.data.modelContractVersion,
      currentModel: model,
      nodeId: input.node.id,
      resolveConfiguration: resolveModelConfiguration,
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
    requestModelChange,
    resolution,
    semanticSlots,
    updatePrompt: (prompt: string) =>
      canvas.updateNodeData(input.node.id, current => ({
        ...current,
        prompt,
      })),
    updateSetting,
    upgradeModelContract,
  }
}
