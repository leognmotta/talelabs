/** Conversion from persisted Flow edges to stable React Flow canvas edges. */

import type { FlowEdge } from '@talelabs/sdk'
import type { CanvasEdge } from '../flow-canvas-types'

import { compareFlowEdgesByPriority } from '@talelabs/flows'

/** Restores persisted edges in deterministic priority order for the canvas. */
export function toCanvasEdges(edges: FlowEdge[]): CanvasEdge[] {
  return edges.toSorted(compareFlowEdgesByPriority).map(edge => ({
    data: { createdAt: edge.createdAt },
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: 'default',
  }))
}
