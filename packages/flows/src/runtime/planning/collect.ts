import type {
  FlowItem,
  RuntimeAssetCollectionValue,
} from '../values/runtime-values.js'

import {
  createRuntimeItem,
  normalizeRuntimeDimensions,
} from '../values/runtime-items.js'

/** Collect removes one outer axis and restores one inner collection. */
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
