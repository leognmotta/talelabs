import type {
  FlowRuntimeValue,
  PriorNodeOutputDescriptor,
} from '../values/runtime-values.js'
import type { FlowRunPlanningIssue } from './run-command.js'
import { compareStableStrings } from '../../graph/ordering/stable.js'
import { runtimeValueType } from '../values/runtime-collections.js'

export function plannedRuntimeOutputValue(input: {
  itemKey: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  nodeId: string
  outputCount: number
}): FlowRuntimeValue {
  if (input.mediaType === 'text') {
    return {
      kind: 'text',
      origin: {
        itemKey: input.itemKey,
        nodeId: input.nodeId,
        source: 'sameRunOutput',
      },
      text: null,
    }
  }
  const kind = input.mediaType === 'image'
    ? 'imageSet'
    : input.mediaType === 'video' ? 'videoSet' : 'audioSet'
  const mediaType = input.mediaType
  return {
    assets: Array.from({ length: input.outputCount }, (_, outputIndex) => ({
      itemKey: input.itemKey,
      mediaType,
      nodeId: input.nodeId,
      outputIndex,
      source: 'sameRunOutput' as const,
    })),
    kind,
  }
}

export function priorOutputCompatible(
  descriptor: PriorNodeOutputDescriptor,
  acceptedValueTypes: readonly string[],
) {
  return descriptor.items.length > 0
    && descriptor.items.every(item =>
      acceptedValueTypes.includes(runtimeValueType(item.value)))
}

export function resolvePriorOutput(input: {
  acceptedValueTypes: readonly string[]
  candidates: readonly PriorNodeOutputDescriptor[]
  issues: FlowRunPlanningIssue[]
  nodeId: string
  outputHandleId: string
}) {
  const pinned = input.candidates.filter(candidate => candidate.pinned)
  if (pinned.length > 1) {
    input.issues.push({
      code: 'ambiguous_pinned_upstream_output',
      field: 'priorOutputs',
      nodeId: input.nodeId,
      params: { outputHandleId: input.outputHandleId },
    })
    return undefined
  }
  if (pinned.length === 1) {
    return priorOutputCompatible(pinned[0]!, input.acceptedValueTypes)
      ? pinned[0]
      : undefined
  }
  return input.candidates
    .filter(candidate =>
      priorOutputCompatible(candidate, input.acceptedValueTypes))
    .toSorted((left, right) =>
      compareStableStrings(right.completedAt, left.completedAt)
      || compareStableStrings(right.generationJobId, left.generationJobId))[0]
}
