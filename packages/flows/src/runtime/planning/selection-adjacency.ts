import type { FlowGraphEdge } from '../../graph/types.js'

import { compareFlowEdgesByPriority } from '../../graph/ordering/edges.js'

export function flowGraphAdjacency(
  nodeIds: ReadonlySet<string>,
  edges: readonly FlowGraphEdge[],
) {
  const incoming = new Map<string, FlowGraphEdge[]>()
  const outgoing = new Map<string, FlowGraphEdge[]>()
  for (const edge of edges.toSorted(compareFlowEdgesByPriority)) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId))
      continue
    incoming.set(edge.targetNodeId, [
      ...(incoming.get(edge.targetNodeId) ?? []),
      edge,
    ])
    outgoing.set(edge.sourceNodeId, [
      ...(outgoing.get(edge.sourceNodeId) ?? []),
      edge,
    ])
  }
  return { incoming, outgoing }
}

export function reachableNodeIds(
  startNodeIds: readonly string[],
  neighbors: ReadonlyMap<string, readonly FlowGraphEdge[]>,
  edgeTarget: (edge: FlowGraphEdge) => string,
) {
  const visited = new Set(startNodeIds)
  const queue = [...startNodeIds].toSorted()
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of neighbors.get(current) ?? []) {
      const neighbor = edgeTarget(edge)
      if (visited.has(neighbor))
        continue
      visited.add(neighbor)
      queue.push(neighbor)
      queue.sort()
    }
  }
  return visited
}
