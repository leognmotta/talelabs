import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import {
  getActiveGenerationSettings,
  resolveLlmState,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useGenerationModelTransition } from '../use-generation-model-transition'
import {
  generationInlineValue,
  useGenerationNodeController,
} from '../use-generation-node-controller'
import { resolveLlmModelConfiguration } from './llm-model-configuration'
import {
  getLlmInputState,
  updateLlmPrompt,
  updateLlmSetting,
} from './llm-node-actions'

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
  const inputSlots = useMemo(
    () => (model?.inputSlots ?? []).filter(slot => slot.id !== 'instructions'),
    [model],
  )
  const itemCounts = useMemo(
    () => Object.fromEntries(inputSlots.map((slot) => {
      return [
        slot.id,
        canvas.getExecutableInputCount(input.node.id, slot.id),
      ]
    })),
    [canvas, input.node.id, inputSlots],
  )
  const inlineInstructions = String(input.node.data.instructions ?? '')
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
  const { requestModelChange, upgradeModelContract }
    = useGenerationModelTransition({
      applyConfiguration: canvas.updateGenerationConfiguration,
      configModels,
      currentContractVersion: input.node.data.modelContractVersion,
      currentModel: model,
      nodeId: input.node.id,
      resolveConfiguration: resolveLlmModelConfiguration.bind(null, {
        canvas,
        incomingConnections: input.incomingConnections,
        node: input.node,
      }),
    })

  const preview = canvas.getGenerationPreview(input.node.id)
  const previewFingerprint = canvas.getGenerationPreviewFingerprint(input.node.id)

  return {
    activeSettings,
    canUpgradeModelContract,
    externalPromptConnected: (connectionCounts.prompt ?? 0) > 0,
    inputState: getLlmInputState.bind(null, { canvas, node: input.node }),
    inputSlots,
    model,
    modelOptions,
    preview,
    previewFingerprint,
    requestModelChange,
    resolution,
    openOutputInspector: canvas.openNodeOutputInspector.bind(null, input.node.id),
    updatePrompt: updateLlmPrompt.bind(null, { canvas, node: input.node }),
    updateSetting: updateLlmSetting.bind(null, {
      canvas,
      connectionCounts,
      inlineInstructions,
      itemCounts,
      model,
      node: input.node,
    }),
    upgradeModelContract,
  }
}
