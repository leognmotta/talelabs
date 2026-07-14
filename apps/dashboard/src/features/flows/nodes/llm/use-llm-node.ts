import type {
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import {
  getActiveGenerationSettings,
  isGenerationSettingValueValid,
  resolveLlmState,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useGenerationModelTransition } from '../use-generation-model-transition'
import {
  generationInlineValue,
  generationInputContracts,
  useGenerationNodeController,
} from '../use-generation-node-controller'

export function useLlmNode(input: {
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
  } = useGenerationNodeController({
    ...input,
    scope: {
      categoryId: 'llm',
      categoryLabelKey: 'flows.llm.category',
      kind: 'mediaType',
      mediaType: 'text',
    },
  })
  const itemCounts = useMemo(
    () => Object.fromEntries((model?.inputSlots ?? []).map((slot) => {
      return [
        slot.id,
        canvas.getExecutableInputCount(input.node.id, slot.id),
      ]
    })),
    [canvas, input.node.id, model?.inputSlots],
  )
  const inlineInstructions = generationInlineValue({
    connectionCounts,
    data: input.node.data,
    slotId: 'instructions',
  })
  const inlinePrompt = generationInlineValue({
    connectionCounts,
    data: input.node.data,
    slotId: 'prompt',
  })
  const resolution = useMemo(
    () => model
      ? resolveLlmState({
          connectionCounts,
          inlineInstructions,
          inlinePrompt,
          itemCounts,
          model,
          settings: input.node.data.settings ?? {},
        })
      : null,
    [
      connectionCounts,
      input.node.data.settings,
      inlineInstructions,
      inlinePrompt,
      itemCounts,
      model,
    ],
  )
  const visibleSettingIds = new Set(resolution?.visibleSettingIds ?? [])
  const activeSettings = model && resolution?.resolvedOperationId
    ? getActiveGenerationSettings(model, resolution.resolvedOperationId)
        .filter(setting => visibleSettingIds.has(setting.id))
    : []
  function targetSettings(targetModel: GenerationModelDefinition) {
    return Object.fromEntries(targetModel.settings.map((setting) => {
      const saved = input.node.data.settings?.[setting.id]
      return [
        setting.id,
        saved !== undefined && isGenerationSettingValueValid(setting, saved)
          ? saved
          : setting.default,
      ]
    })) as Record<string, GenerationSettingValue>
  }

  function resolveModelConfiguration(
    targetModel: GenerationModelDefinition,
    targetContractVersion: string,
  ) {
    const compatibleEdgeIds = new Set(
      canvas.getIncompatibleGenerationEdges(
        input.node.id,
        generationInputContracts({ model: targetModel }),
      ).map(edge => edge.id),
    )
    const targetCounts: Record<string, number> = {}
    for (const connection of input.incomingConnections) {
      if (
        connection.edgeId
        && compatibleEdgeIds.has(connection.edgeId)
      ) {
        continue
      }
      if (
        connection.targetHandle
        && targetModel.inputSlots.some(slot => slot.id === connection.targetHandle)
      ) {
        targetCounts[connection.targetHandle]
          = (targetCounts[connection.targetHandle] ?? 0) + 1
      }
    }
    const targetItems = Object.fromEntries(
      targetModel.inputSlots.map(slot => [
        slot.id,
        canvas.getExecutableInputCount(input.node.id, slot.id),
      ]),
    )
    const next = resolveLlmState({
      connectionCounts: targetCounts,
      inlineInstructions: generationInlineValue({
        connectionCounts: targetCounts,
        data: input.node.data,
        slotId: 'instructions',
      }),
      inlinePrompt: generationInlineValue({
        connectionCounts: targetCounts,
        data: input.node.data,
        slotId: 'prompt',
      }),
      itemCounts: targetItems,
      model: targetModel,
      settings: targetSettings(targetModel),
    })
    return {
      activeInputContracts: generationInputContracts({ model: targetModel }),
      inputMaximums: Object.fromEntries(
        targetModel.inputSlots.map(slot => [slot.id, slot.maxItems]),
      ),
      inputSlotIds: targetModel.inputSlots.map(slot => slot.id),
      modelContractVersion: targetContractVersion,
      modelId: targetModel.id,
      operationId: next.resolvedOperationId ?? targetModel.defaultOperationId,
      settings: next.normalizedSettings,
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
    if (!model)
      return
    const next = resolveLlmState({
      connectionCounts,
      inlineInstructions: generationInlineValue({
        connectionCounts,
        data: input.node.data,
        slotId: 'instructions',
      }),
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

  const preview = canvas.getGenerationPreview(input.node.id)
  const previewFingerprint = canvas.getGenerationPreviewFingerprint(input.node.id)

  return {
    activeSettings,
    canUpgradeModelContract,
    externalPromptConnected: (connectionCounts.prompt ?? 0) > 0,
    inputState,
    model,
    modelOptions,
    preview,
    previewFingerprint,
    requestModelChange,
    resolution,
    openOutputInspector: () => canvas.openNodeOutputInspector(input.node.id),
    updatePrompt: (prompt: string) => canvas.updateNodeData(
      input.node.id,
      current => ({ ...current, prompt }),
    ),
    updateSetting,
    upgradeModelContract,
  }
}
