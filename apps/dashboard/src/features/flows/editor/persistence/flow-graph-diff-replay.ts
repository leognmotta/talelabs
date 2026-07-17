/** Conflict reconciliation for replaying a local graph diff onto a server graph. */

import type { PersistedCanvasGraph } from '../flow-canvas-types'
import type { FlowGraphDiff } from './flow-graph-diff'

import { compareFlowEdgesByPriority } from '@talelabs/flows'

/** Reports whether a diff contains any work that must be persisted. */
export function hasFlowGraphMutations(diff: FlowGraphDiff) {
  return diff.deleteNodeIds.length > 0
    || diff.deleteEdgeIds.length > 0
    || diff.upsertNodes.length > 0
    || diff.upsertEdges.length > 0
}

/**
 * Replays local edits over the latest server graph and drops edges whose nodes
 * no longer exist after reconciliation.
 */
export function replayFlowGraphDiff(
  server: PersistedCanvasGraph,
  diff: FlowGraphDiff,
): {
  droppedEdgeIds: string[]
  graph: PersistedCanvasGraph
} {
  const nodes = new Map(server.nodes.map(node => [node.id, node]))
  for (const id of diff.deleteNodeIds)
    nodes.delete(id)
  for (const node of diff.upsertNodes)
    nodes.set(node.id, node)

  const edges = new Map(server.edges.map(edge => [edge.id, edge]))
  for (const id of diff.deleteEdgeIds)
    edges.delete(id)
  for (const edge of diff.upsertEdges)
    edges.set(edge.id, edge)

  const droppedEdgeIds: string[] = []
  for (const [edgeId, edge] of edges) {
    if (nodes.has(edge.sourceNodeId) && nodes.has(edge.targetNodeId))
      continue
    edges.delete(edgeId)
    droppedEdgeIds.push(edgeId)
  }

  return {
    droppedEdgeIds,
    graph: {
      nodes: [...nodes.values()],
      edges: [...edges.values()].toSorted(compareFlowEdgesByPriority),
    },
  }
}
