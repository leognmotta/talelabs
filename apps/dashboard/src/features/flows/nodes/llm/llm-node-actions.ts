/** LLM prompt, setting, and input-state commands over a scoped node canvas. */

import type {
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
  GenerationSettingValue,
  PromptTemplate,
} from '@talelabs/flows'
import type { CanvasNode } from '../../editor/flow-canvas-types'
import type { GenerationNodeCanvas } from '../shared/generation-node/use-generation-node-controller'

import { resolveLlmState } from '@talelabs/flows'
import { generationInlineValue } from '../shared/generation-node/use-generation-node-controller'

interface LlmActionContext {
  canvas: GenerationNodeCanvas
  connectionCounts: Readonly<Record<string, number>>
  inlineInstructions: string
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition | undefined
  node: Pick<CanvasNode, 'data' | 'id'>
}

/** Applies one LLM setting and its derived operation state. */
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

/** Resolves current selected and available items for one LLM input slot. */
export function getLlmInputState(
  context: Pick<LlmActionContext, 'canvas' | 'node'>,
  slot: GenerationInputSlotDefinition,
) {
  return context.canvas.getInputState(context.node.id, slot.id)
}

/** Applies the inline prompt for one LLM node. */
export function updateLlmPrompt(
  context: Pick<LlmActionContext, 'canvas' | 'node'>,
  prompt: PromptTemplate,
) {
  context.canvas.updateNodeData(
    context.node.id,
    current => ({ ...current, prompt }),
  )
}
