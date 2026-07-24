/** Canonical provider-neutral request payload assembly for planned jobs. */

import type { FlowGraphNode } from '../../graph/types.js'
import type { PlannedRunInput } from './planner-contracts.js'
import { compareStableStrings } from '../../graph/ordering/stable.js'
import { coercePromptTemplate } from '../../prompts/schema.js'
import { compileGenerationJob } from '../compilation/generation-job.js'

function normalizedInlineText(node: FlowGraphNode) {
  return Object.freeze(Object.fromEntries(
    Object.entries(node.data)
      .filter(([key, value]) =>
        ['instructions', 'lyrics', 'prompt'].includes(key)
        && typeof value === 'string')
      .toSorted(([left], [right]) => compareStableStrings(left, right)),
  ) as Record<string, string>)
}

function normalizedInputSelections(node: FlowGraphNode) {
  const selections = node.data.inputSelections as
    | Record<string, { assetIds?: string[], mode: 'auto' | 'manual' }>
    | undefined
  if (!selections)
    return Object.freeze({})
  return Object.freeze(Object.fromEntries(
    Object.entries(selections)
      .filter(([, selection]) => selection.mode === 'manual')
      .map(([slotId, selection]) => [
        slotId,
        Object.freeze([...(selection.assetIds ?? [])].toSorted(compareStableStrings)),
      ] as const)
      .toSorted(([left], [right]) => compareStableStrings(left, right)),
  ))
}

function normalizedPromptTemplates(node: FlowGraphNode) {
  return node.data.prompt === undefined
    ? Object.freeze({})
    : Object.freeze({ prompt: coercePromptTemplate(node.data.prompt) })
}

/** Adapts one materialized Flow coordinate to the shared job compiler. */
export function compileFlowGenerationJob(input: {
  catalogRevision: string
  catalogVersion: number
  inputLimits: Readonly<Record<string, number>>
  inputs: readonly PlannedRunInput[]
  itemKey: string
  modelContractVersion: string
  modelId: string
  modelRevision: number
  node: FlowGraphNode
  operationId: string
  outputCount: number
  requestIndex: number
  settings: Readonly<Record<string, boolean | number | string>>
}) {
  return compileGenerationJob({
    catalogRevision: input.catalogRevision,
    catalogVersion: input.catalogVersion,
    executionStepId: input.node.id,
    inline: normalizedInlineText(input.node),
    inputLimits: Object.freeze({ ...input.inputLimits }),
    inputSelections: normalizedInputSelections(input.node),
    inputs: Object.freeze(input.inputs.map(plannedInput => Object.freeze({
      bindingId: plannedInput.edgeId,
      items: plannedInput.items,
      sourceId: plannedInput.sourceNodeId,
      sourceOutputId: plannedInput.sourceHandleId,
      targetSlotId: plannedInput.targetHandleId,
    }))),
    itemKey: input.itemKey,
    modelContractVersion: input.modelContractVersion,
    modelId: input.modelId,
    modelRevision: input.modelRevision,
    operationId: input.operationId,
    outputCount: input.outputCount,
    promptTemplates: normalizedPromptTemplates(input.node),
    requestIndex: input.requestIndex,
    settings: input.settings,
  })
}
