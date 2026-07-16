import type { FlowGraphNode } from '../../graph/types.js'
import type {
  PlannedJobRequestPayload,
  PlannedRunInput,
} from './planner-contracts.js'
import { compareStableStrings } from '../../graph/ordering/stable.js'

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

/** Canonical, provider-independent request identity used for job hashing. */
export function createPlannedJobRequestPayload(input: {
  inputs: readonly PlannedRunInput[]
  itemKey: string
  modelContractVersion: string
  modelId: string
  node: FlowGraphNode
  operationId: string
  outputCount: number
  requestIndex: number
  settings: Readonly<Record<string, boolean | number | string>>
}): PlannedJobRequestPayload {
  return Object.freeze({
    inline: normalizedInlineText(input.node),
    inputSelections: normalizedInputSelections(input.node),
    inputs: Object.freeze(input.inputs.map(plannedInput => Object.freeze({
      edgeId: plannedInput.edgeId,
      items: plannedInput.items,
      sourceHandleId: plannedInput.sourceHandleId,
      sourceNodeId: plannedInput.sourceNodeId,
      targetHandleId: plannedInput.targetHandleId,
    }))),
    itemKey: input.itemKey,
    modelContractVersion: input.modelContractVersion,
    modelId: input.modelId,
    nodeId: input.node.id,
    operationId: input.operationId,
    outputCount: input.outputCount,
    requestIndex: input.requestIndex,
    requestPayloadVersion: 1 as const,
    settings: input.settings,
  })
}
