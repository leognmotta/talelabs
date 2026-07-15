import type {
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import {
  applyGenerationSettingRequirements,
  getActiveGenerationSettings,
  isGenerationSettingValueValid,
  resolveVideoGenerationState,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useGenerationModelTransition } from '../use-generation-model-transition'
import {
  generationInlineValue,
  generationInputContracts,
  useGenerationNodeController,
} from '../use-generation-node-controller'

export function useVideoGenerationNode(input: {
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
      categoryId: 'video',
      categoryLabelKey: 'assets.types.video',
      kind: 'mediaType',
      mediaType: 'video',
    },
  })
  const itemCounts = useMemo(
    () =>
      Object.fromEntries(
        (model?.inputSlots ?? []).map((slot) => {
          return [
            slot.id,
            canvas.getExecutableInputCount(input.node.id, slot.id),
          ]
        }),
      ),
    [canvas, input.node.id, model?.inputSlots],
  )
  const inlinePrompt = generationInlineValue({
    connectionCounts,
    data: input.node.data,
    slotId: 'prompt',
  })
  const resolution = useMemo(
    () =>
      model
        ? resolveVideoGenerationState({
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
        ).filter(setting => visibleSettingIds.has(setting.id))
      : []
  function normalizedSettings(targetModel: GenerationModelDefinition) {
    const settings = Object.fromEntries(
      targetModel.settings.map((setting) => {
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
      targetModel.inputSlots.map(slot => [
        slot.id,
        connectionCounts[slot.id] ?? 0,
      ]),
    )
    const targetItems = Object.fromEntries(
      targetModel.inputSlots.map(slot => [
        slot.id,
        canvas.getExecutableInputCount(input.node.id, slot.id),
      ]),
    )
    const targetResolution = resolveVideoGenerationState({
      connectionCounts: targetCounts,
      inlinePrompt: generationInlineValue({
        connectionCounts,
        data: input.node.data,
        slotId: 'prompt',
      }),
      itemCounts: targetItems,
      model: targetModel,
      settings,
    })
    return applyGenerationSettingRequirements({
      connectedSlotIds: new Set(
        Object.entries(targetCounts)
          .filter(([, count]) => count > 0)
          .map(([slotId]) => slotId),
      ),
      model: targetModel,
      operationId:
        targetResolution.resolvedOperationId ?? targetModel.defaultOperationId,
      settings,
    })
  }

  function resolveModelConfiguration(
    targetModel: GenerationModelDefinition,
    targetContractVersion: string,
  ) {
    const settings = normalizedSettings(targetModel)
    return {
      activeInputContracts: generationInputContracts({ model: targetModel }),
      inputSlotIds: targetModel.inputSlots.map(slot => slot.id),
      modelContractVersion: targetContractVersion,
      modelId: targetModel.id,
      operationId: targetModel.defaultOperationId,
      settings,
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
    if (!model || !resolution?.resolvedOperationId)
      return
    const settings = applyGenerationSettingRequirements({
      connectedSlotIds: new Set(
        Object.entries(connectionCounts)
          .filter(([, count]) => count > 0)
          .map(([slotId]) => slotId),
      ),
      model,
      operationId: resolution.resolvedOperationId,
      settings: { ...input.node.data.settings, [settingId]: value },
    })
    canvas.updateNodeData(input.node.id, current => ({
      ...current,
      settings,
    }))
  }

  function inputState(slot: GenerationInputSlotDefinition) {
    return canvas.getInputState(input.node.id, slot.id)
  }

  return {
    activeSettings,
    canUpgradeModelContract,
    externalPromptConnected: (connectionCounts.prompt ?? 0) > 0,
    hasRunnablePlan: Boolean(canvas.getGenerationPreviewFingerprint(input.node.id)),
    inputState,
    model,
    modelOptions,
    requestModelChange,
    resolution,
    updatePrompt: (prompt: string) =>
      canvas.updateNodeData(input.node.id, current => ({
        ...current,
        prompt,
      })),
    updateSetting,
    upgradeModelContract,
  }
}
