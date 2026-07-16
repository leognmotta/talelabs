import type {
  FlowItem,
  FlowItemReference,
  RuntimeDimensions,
} from './runtime-values.js'

import { compareStableStrings } from '../../graph/ordering/stable.js'
import { hashFlowRunItem } from '../serialization/execution-hashes.js'

export function normalizeRuntimeDimensions(
  dimensions: RuntimeDimensions,
): RuntimeDimensions {
  return Object.freeze(Object.fromEntries(
    Object.entries(dimensions).toSorted(([left], [right]) =>
      compareStableStrings(left, right)),
  ))
}

export function deriveRuntimeItemKey(input: {
  dimensions: RuntimeDimensions
  lineage: readonly FlowItemReference[]
  nodeId: string
}) {
  return `item_${hashFlowRunItem({
    dimensions: normalizeRuntimeDimensions(input.dimensions),
    lineage: input.lineage,
    nodeId: input.nodeId,
  })}`
}

export function createRuntimeItem<T>(input: {
  dimensions?: RuntimeDimensions
  key?: string
  lineage?: readonly FlowItemReference[]
  nodeId: string
  value: T
}): FlowItem<T> {
  const dimensions = normalizeRuntimeDimensions(input.dimensions ?? {})
  const lineage = Object.freeze([...(input.lineage ?? [])])
  return Object.freeze({
    dimensions,
    key: input.key ?? deriveRuntimeItemKey({
      dimensions,
      lineage,
      nodeId: input.nodeId,
    }),
    lineage,
    value: input.value,
  })
}
