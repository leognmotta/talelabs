/** Input-port preview projection from connected nodes and selected Assets. */

import type { FlowHandleDefinition } from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type { CanvasEdge, CanvasNode } from '../../../editor/flow-canvas-types'
import type { FlowNodePortCanvas, PortPreviewItem } from './flow-node-port-preview'

import { compareFlowEdgesByPriority, getFlowNodeHandles } from '@talelabs/flows'
import { canvasNodeToGraphNode } from '../../../editor/persistence/flow-node-serialization'
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
  const selectedDirectLimit = inputState?.selectedAvailableCount ?? 0
  let selectedDirectCount = 0
  const items: PortPreviewItem[] = []

  const incomingEdges = edges
    .filter(edge => edge.target === node.id && edge.targetHandle === handle.id)
    .toSorted(compareFlowEdgesByPriority)
  for (const edge of incomingEdges) {
    const directCandidates = (inputState?.candidates ?? []).filter(candidate => (
      candidate.sourceId === edge.source
      && selectedAssetIds.has(candidate.assetId)
    ))
    if (directCandidates.length > 0) {
      for (const candidate of directCandidates) {
        if (selectedDirectCount >= selectedDirectLimit)
          break
        const asset = canvas.referenceData.assetsById.get(candidate.assetId)
        if (!asset)
          continue
        items.push({
          asset,
          id: `${handle.id}:connection:${edge.id}:asset:${asset.id}`,
          name: asset.name,
          valueType,
        })
        selectedDirectCount += 1
      }
      continue
    }
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
