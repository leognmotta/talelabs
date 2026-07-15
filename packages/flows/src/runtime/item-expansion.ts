import type {
  FlowItem,
  FlowItemReference,
  FlowRuntimeValue,
  RuntimeAssetCollectionValue,
  RuntimeDimensions,
} from './runtime-values.js'

import { compareStableStrings } from '../stable-order.js'

import {
  createRuntimeItem,
  normalizeRuntimeDimensions,
} from './runtime-values.js'

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

export class RuntimeCoordinateLimitError extends RangeError {
  readonly code = 'runtime_coordinate_limit'
  readonly maximum: number

  constructor(maximum: number) {
    super(`Runtime coordinate count exceeds ${maximum}`)
    this.name = 'RuntimeCoordinateLimitError'
    this.maximum = maximum
  }
}

/**
 * Shared dimensions pair by coordinate, while independent dimensions produce
 * a Cartesian product. Dimensionless values broadcast into every coordinate.
 */
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

/** Explicit Iterator/Map expansion: one inner Asset becomes one outer item. */
export function createIteratorItems(input: {
  dimensionId?: string
  inputHandleId: string
  item: FlowItem<RuntimeAssetCollectionValue>
  nodeId: string
  sourceNodeId: string
}) {
  const dimensionId = input.dimensionId ?? input.nodeId
  return input.item.value.assets.map((asset, index) => {
    const dimensions = {
      ...input.item.dimensions,
      [dimensionId]: String(index),
    }
    return createRuntimeItem<RuntimeAssetCollectionValue>({
      dimensions,
      lineage: [{
        handleId: input.inputHandleId,
        itemKey: input.item.key,
        nodeId: input.sourceNodeId,
      }],
      nodeId: input.nodeId,
      value: { assets: [asset], kind: input.item.value.kind },
    })
  })
}

/** Prompt Iterator expansion uses the same explicit outer-dimension contract. */
export function createPromptIteratorItems(input: {
  dimensionId?: string
  nodeId: string
  prompts: readonly string[]
}) {
  const dimensionId = input.dimensionId ?? input.nodeId
  return input.prompts.map((text, index) => createRuntimeItem<FlowRuntimeValue>({
    dimensions: { [dimensionId]: String(index) },
    nodeId: input.nodeId,
    value: {
      kind: 'text',
      origin: { nodeId: input.nodeId, source: 'staticText' },
      text,
    },
  }))
}

/**
 * Collect removes one explicit outer axis and restores one inner collection.
 * Remaining axes must already identify one coordinate.
 */
export function collectRuntimeAssetItems(input: {
  dimensionId: string
  inputHandleId: string
  items: readonly FlowItem<RuntimeAssetCollectionValue>[]
  nodeId: string
  sourceNodeId: string
}) {
  if (input.items.length === 0)
    throw new RangeError('collect_requires_items')
  const kind = input.items[0]!.value.kind
  if (input.items.some(item => item.value.kind !== kind))
    throw new TypeError('collect_requires_matching_collection_types')

  const remainingDimensions = input.items.map((item) => {
    const dimensions = { ...item.dimensions }
    delete dimensions[input.dimensionId]
    return normalizeRuntimeDimensions(dimensions)
  })
  const signature = JSON.stringify(remainingDimensions[0])
  if (remainingDimensions.some(item => JSON.stringify(item) !== signature))
    throw new RangeError('collect_requires_one_remaining_coordinate')

  return createRuntimeItem<RuntimeAssetCollectionValue>({
    dimensions: remainingDimensions[0],
    lineage: input.items.map(item => ({
      handleId: input.inputHandleId,
      itemKey: item.key,
      nodeId: input.sourceNodeId,
    })),
    nodeId: input.nodeId,
    value: {
      assets: input.items.flatMap(item => item.value.assets),
      kind,
    } as RuntimeAssetCollectionValue,
  })
}
