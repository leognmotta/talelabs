/** Input-port preview projection from connected nodes and selected Assets. */

import type { FlowHandleDefinition } from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
import type { FlowNodePortCanvas, PortPreviewItem } from './flow-node-port-preview'

import { compareFlowEdgesByPriority, getFlowNodeHandles } from '@talelabs/flows'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'
import { outputPortPreviewItems } from './flow-node-port-output-items'

/** Projects selected direct Assets and connected outputs for one input port. */
export function inputPortPreviewItems(
  edges: CanvasEdge[],
  handle: FlowHandleDefinition,
  node: CanvasNode,
  canvas: FlowNodePortCanvas,
  t: TFunction,
): PortPreviewItem[] {
  const valueType = handle.valueTypes[0]
  if (!valueType)
    return []

  const inputState = canvas.getInputState(node.id, handle.id)
  const selectedAssetIds = new Set(inputState?.selectedAssetIds ?? [])
  const representedDirectAssetSourceIds = new Set<string>()
  const items: PortPreviewItem[] = []

  for (const candidate of inputState?.candidates ?? []) {
    if (!selectedAssetIds.has(candidate.assetId))
      continue
    const asset = canvas.referenceData.assetsById.get(candidate.assetId)
    if (!asset)
      continue
    representedDirectAssetSourceIds.add(candidate.sourceId)
    items.push({
      asset,
      id: `${handle.id}:asset:${asset.id}`,
      name: asset.name,
      valueType,
    })
  }

  const incomingEdges = edges
    .filter(edge => edge.target === node.id && edge.targetHandle === handle.id)
    .toSorted(compareFlowEdgesByPriority)
  for (const edge of incomingEdges) {
    if (representedDirectAssetSourceIds.has(edge.source))
      continue
    const sourceNode = canvas.getNode(edge.source)
    if (!sourceNode || !edge.sourceHandle)
      continue
    const sourceHandle = getFlowNodeHandles(
      canvasNodeToGraphNode(sourceNode),
      canvas.referenceData,
    ).find(candidate => (
      candidate.direction === 'output' && candidate.id === edge.sourceHandle
    ))
    if (!sourceHandle)
      continue
    const sourceItems = outputPortPreviewItems(
      sourceHandle,
      sourceNode,
      canvas,
      t,
    )
    items.push(...sourceItems.map((item, index) => ({
      ...item,
      id: `${handle.id}:connection:${edge.id}:${index}:${item.id}`,
    })))
  }

  return items
}
