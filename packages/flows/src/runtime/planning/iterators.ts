import type {
  FlowItem,
  FlowRuntimeValue,
  RuntimeAssetCollectionValue,
} from '../values/runtime-values.js'

import { createRuntimeItem } from '../values/runtime-items.js'

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
