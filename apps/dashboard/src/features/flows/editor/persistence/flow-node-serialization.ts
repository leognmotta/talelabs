/** Conversion between persisted Flow nodes and React Flow canvas nodes. */

import type { FlowNode } from '@talelabs/sdk'
import type { CanvasNode } from '../flow-canvas-types'

/** Converts a canvas node to the exact persisted graph-node representation. */
export function canvasNodeToGraphNode(node: CanvasNode) {
  return {
    assetId: node.assetId,
    data: node.data,
    id: node.id,
    positionX: node.position.x,
    positionY: node.position.y,
    schemaVersion: node.schemaVersion,
    type: node.type,
  }
}

/** Converts persisted graph nodes to draggable canvas nodes. */
export function toCanvasNodes(nodes: FlowNode[]): CanvasNode[] {
  return nodes.map(node => ({
    id: node.id,
    type: node.type,
    draggable: node.data.locked !== true,
    position: { x: node.positionX, y: node.positionY },
    data: node.data,
    assetId: node.assetId,
    schemaVersion: node.schemaVersion,
  }))
}
