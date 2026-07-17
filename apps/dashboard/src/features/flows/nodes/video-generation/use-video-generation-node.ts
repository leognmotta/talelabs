/** Narrow canvas and server-state controller for one video-generation node. */

import type {
  GenerationInputSlotDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../editor/flow-canvas-types'

import {
  applyGenerationSettingRequirements,
  getActiveGenerationSettings,
  resolveVideoGenerationState,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useGenerationModelTransition } from '../shared/generation-node/use-generation-model-transition'
import {
  generationInlineValue,
  useGenerationNodeController,
} from '../shared/generation-node/use-generation-node-controller'
import { resolveVideoGenerationModelConfiguration } from './video-generation-model-configuration'

/** Resolves one video-generation node and binds its model/settings canvas actions. */
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
  const { requestModelChange, upgradeModelContract }
    = useGenerationModelTransition({
      applyConfiguration: canvas.updateGenerationConfiguration,
      configModels,
      currentContractVersion: input.node.data.modelContractVersion,
      currentModel: model,
      nodeId: input.node.id,
      resolveConfiguration: (targetModel, targetContractVersion) =>
        resolveVideoGenerationModelConfiguration({
          connectionCounts,
          getExecutableInputCount: (nodeId, slotId) =>
            canvas.getExecutableInputCount(nodeId, slotId),
          node: input.node,
          targetContractVersion,
          targetModel,
        }),
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
