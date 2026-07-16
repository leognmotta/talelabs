import type {
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { FlowCanvasContextValue } from '../../flow-canvas-context'
import type { CanvasNode } from '../../flow-canvas-types'

import { resolveLlmState } from '@talelabs/flows'
import { generationInlineValue } from '../use-generation-node-controller'

interface LlmActionContext {
  canvas: FlowCanvasContextValue
  connectionCounts: Readonly<Record<string, number>>
  inlineInstructions: string
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition | undefined
  node: Pick<CanvasNode, 'data' | 'id'>
}

export function updateLlmSetting(
  context: LlmActionContext,
  settingId: string,
  value: GenerationSettingValue,
) {
  const { canvas, connectionCounts, inlineInstructions, itemCounts, model, node }
    = context
  if (!model)
    return
  const next = resolveLlmState({
    connectionCounts,
    inlineInstructions,
    inlinePrompt: generationInlineValue({
      connectionCounts,
      data: node.data,
      slotId: 'prompt',
    }),
    itemCounts,
    model,
    settings: { ...node.data.settings, [settingId]: value },
  })
  canvas.updateNodeData(node.id, current => ({
    ...current,
    operationId: next.resolvedOperationId ?? current.operationId,
    settings: next.normalizedSettings,
  }))
}

export function getLlmInputState(
  context: Pick<LlmActionContext, 'canvas' | 'node'>,
  slot: GenerationInputSlotDefinition,
) {
  return context.canvas.getInputState(context.node.id, slot.id)
}

export function updateLlmPrompt(
  context: Pick<LlmActionContext, 'canvas' | 'node'>,
  prompt: string,
) {
  context.canvas.updateNodeData(
    context.node.id,
    current => ({ ...current, prompt }),
  )
}
