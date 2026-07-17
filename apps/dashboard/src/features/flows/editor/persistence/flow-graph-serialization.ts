/** Construction of the persisted graph from current canvas nodes and edges. */

import type { CanvasEdge, CanvasNode, PersistedCanvasGraph } from '../flow-canvas-types'

import { compareFlowEdgesByPriority } from '@talelabs/flows'
import { canvasNodeToGraphNode } from './flow-node-serialization'

/**
 * Removes transient nodes and dangling edges, then serializes the remaining
 * graph in deterministic edge priority order.
 */
export function toPersistedGraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): PersistedCanvasGraph {
  const persistedNodes = nodes.filter(node => !node.transient)
  const persistedNodeIds = new Set(persistedNodes.map(node => node.id))

  return {
    nodes: persistedNodes.map(canvasNodeToGraphNode),
    edges: edges
      .filter(edge => (
        persistedNodeIds.has(edge.source) && persistedNodeIds.has(edge.target)
      ))
      .toSorted(compareFlowEdgesByPriority)
      .map(edge => ({
        createdAt: edge.data?.createdAt ?? '1970-01-01T00:00:00.000Z',
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
      })),
  }
}
