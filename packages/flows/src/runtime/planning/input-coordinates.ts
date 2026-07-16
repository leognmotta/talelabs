import type {
  FlowItem,
  FlowItemReference,
  FlowRuntimeValue,
  RuntimeDimensions,
} from '../values/runtime-values.js'

import { compareStableStrings } from '../../graph/ordering/stable.js'
import { normalizeRuntimeDimensions } from '../values/runtime-items.js'
import { RuntimeCoordinateLimitError } from './runtime-coordinate-limit-error.js'

export interface RuntimeInputBinding {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

export interface ExpandedRuntimeInputCoordinate {
  dimensions: RuntimeDimensions
  inputs: readonly {
    binding: RuntimeInputBinding
    items: readonly FlowItem<FlowRuntimeValue>[]
  }[]
  lineage: readonly FlowItemReference[]
}

function matchesCoordinate(
  dimensions: RuntimeDimensions,
  coordinate: RuntimeDimensions,
) {
  return Object.entries(dimensions).every(
    ([axis, value]) => coordinate[axis] === value,
  )
}

function cartesianCoordinates(
  axes: readonly { id: string, values: readonly string[] }[],
  maximumCoordinates: number,
): RuntimeDimensions[] {
  let coordinates: RuntimeDimensions[] = [Object.freeze({})]
  for (const axis of axes) {
    if (coordinates.length > Math.floor(maximumCoordinates / axis.values.length))
      throw new RuntimeCoordinateLimitError(maximumCoordinates)
    coordinates = coordinates.flatMap(coordinate => axis.values.map(value =>
      normalizeRuntimeDimensions({ ...coordinate, [axis.id]: value })))
  }
  return coordinates
}

/** Shared dimensions pair; independent dimensions form a Cartesian product. */
export function expandRuntimeInputCoordinates(
  bindings: readonly RuntimeInputBinding[],
  maximumCoordinates = Number.MAX_SAFE_INTEGER,
): ExpandedRuntimeInputCoordinate[] {
  const valuesByAxis = new Map<string, string[]>()
  for (const binding of bindings) {
    for (const item of binding.items) {
      for (const [axis, value] of Object.entries(item.dimensions)) {
        const values = valuesByAxis.get(axis) ?? []
        if (!values.includes(value))
          values.push(value)
        valuesByAxis.set(axis, values)
      }
    }
  }

  const axes = [...valuesByAxis]
    .toSorted(([left], [right]) => compareStableStrings(left, right))
    .map(([id, values]) => ({ id, values }))
  const coordinates = axes.length > 0
    ? cartesianCoordinates(axes, maximumCoordinates)
    : [Object.freeze({})]

  return coordinates.map((dimensions) => {
    const inputs = bindings.map(binding => ({
      binding,
      items: binding.items.filter(item =>
        matchesCoordinate(item.dimensions, dimensions)),
    }))
    const lineage = inputs.flatMap(({ binding, items }) => items.map(item => ({
      handleId: binding.sourceHandleId,
      itemKey: item.key,
      nodeId: binding.sourceNodeId,
    })))
    return Object.freeze({
      dimensions,
      inputs: Object.freeze(inputs),
      lineage: Object.freeze(lineage),
    })
  })
}
