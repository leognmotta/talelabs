/** Shared narrow controller for model-adaptive audio intent nodes. */

import type {
  AudioIntentNodeType,
  GenerationInputSlotDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../editor/flow-canvas-types'

import {
  getActiveGenerationSettings,
  getGenerationOperationsForNodeType,
  resolveAudioNodeState,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useGenerationModelTransition } from '../shared/generation-node/use-generation-model-transition'
import {
  generationInlineValue,
  useGenerationNodeController,
} from '../shared/generation-node/use-generation-node-controller'
import { resolveAudioModelConfiguration } from './audio-model-configuration'

/** Resolves one audio-intent node and binds its model/settings canvas actions. */
export function useAudioIntentNode(input: {
  incomingConnections: readonly NodeConnection[]
  node: Pick<CanvasNode, 'data' | 'id' | 'type'>
  nodeType: AudioIntentNodeType
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
    incomingConnections: input.incomingConnections,
    node: input.node,
    scope: {
      categoryId: input.nodeType,
      categoryLabelKey: 'flows.audio.category',
      kind: 'nodeType',
      nodeType: input.nodeType,
    },
  })
  const itemCounts = useMemo(
    () => Object.fromEntries(slots.map((slot) => {
      return [
        slot.id,
        canvas.getExecutableInputCount(input.node.id, slot.id),
      ]
    })),
    [canvas, input.node.id, slots],
  )
  const inlineLyrics = generationInlineValue({
    connectionCounts,
    data: input.node.data,
    slotId: 'lyrics',
  })
  const inlinePrompt = generationInlineValue({
    connectionCounts,
    data: input.node.data,
    slotId: 'prompt',
  })
  const resolution = useMemo(
    () => model
      ? resolveAudioNodeState(input.nodeType, {
          connectionCounts,
          inlineLyrics,
          inlinePrompt,
          itemCounts,
          model,
          settings: input.node.data.settings ?? {},
        })
      : null,
    [
      connectionCounts,
      input.node.data.settings,
      input.nodeType,
      inlineLyrics,
      inlinePrompt,
      itemCounts,
      model,
    ],
  )
  const visibleSettingIds = new Set(resolution?.visibleSettingIds ?? [])
  const operation = model
    ? getGenerationOperationsForNodeType(model, input.nodeType).find(
        item => item.id === resolution?.resolvedOperationId,
      )
    : undefined
  const activeSettings = model && operation
    ? getActiveGenerationSettings(model, operation.id).filter(setting =>
        visibleSettingIds.has(setting.id),
      )
    : []
  const { requestModelChange, upgradeModelContract }
    = useGenerationModelTransition({
      applyConfiguration: canvas.updateGenerationConfiguration,
      configModels,
      currentContractVersion: input.node.data.modelContractVersion,
      currentModel: model,
      nodeId: input.node.id,
      resolveConfiguration: (targetModel, targetContractVersion) =>
        resolveAudioModelConfiguration({
          connectionCounts,
          itemCounts,
          nodeData: input.node.data,
          nodeType: input.nodeType,
          targetContractVersion,
          targetModel,
        }),
    })

  function updateSetting(settingId: string, value: GenerationSettingValue) {
    if (!model)
      return
    const nextSettings = { ...input.node.data.settings, [settingId]: value }
    const nextResolution = resolveAudioNodeState(input.nodeType, {
      connectionCounts,
      inlineLyrics: generationInlineValue({
        connectionCounts,
        data: input.node.data,
        slotId: 'lyrics',
      }),
      inlinePrompt: generationInlineValue({
        connectionCounts,
        data: input.node.data,
        slotId: 'prompt',
      }),
      itemCounts,
      model,
      settings: nextSettings,
    })
    canvas.updateNodeData(input.node.id, current => ({
      ...current,
      operationId: nextResolution.resolvedOperationId ?? current.operationId,
      settings: { ...nextSettings, ...nextResolution.normalizedSettings },
    }))
  }

  function inputState(slot: GenerationInputSlotDefinition) {
    return canvas.getInputState(input.node.id, slot.id)
  }

  return {
    activeSettings,
    canUpgradeModelContract,
    externalLyricsConnected: (connectionCounts.lyrics ?? 0) > 0,
    externalPromptConnected: (connectionCounts.prompt ?? 0) > 0,
    inputState,
    model,
    modelOptions,
    requestModelChange,
    resolution,
    slots,
    updateLyrics: (lyrics: string) =>
      canvas.updateNodeData(input.node.id, current => ({ ...current, lyrics })),
    updatePrompt: (prompt: string) =>
      canvas.updateNodeData(input.node.id, current => ({ ...current, prompt })),
    updateSetting,
    upgradeModelContract,
  }
}
