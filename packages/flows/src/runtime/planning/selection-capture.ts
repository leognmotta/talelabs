import type { FlowGraphEdge } from '../../graph/types.js'

export function captureRequiredFlowGraph(input: {
  executableNodeIds: ReadonlySet<string>
  incoming: ReadonlyMap<string, readonly FlowGraphEdge[]>
  plannedExecutableNodeIds: ReadonlySet<string>
}) {
  const capturedNodeIds = new Set(input.plannedExecutableNodeIds)
  const capturedEdgeIds = new Set<string>()
  const queue = [...input.plannedExecutableNodeIds].toSorted()
  const expanded = new Set<string>()

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    if (expanded.has(nodeId))
      continue
    expanded.add(nodeId)
    for (const edge of input.incoming.get(nodeId) ?? []) {
      capturedEdgeIds.add(edge.id)
      capturedNodeIds.add(edge.sourceNodeId)
      if (
        input.executableNodeIds.has(edge.sourceNodeId)
        && !input.plannedExecutableNodeIds.has(edge.sourceNodeId)
      ) {
        continue
      }
      queue.push(edge.sourceNodeId)
      queue.sort()
    }
  }

  return { capturedEdgeIds, capturedNodeIds }
}

export function executableDependencies(input: {
  executableNodeIds: ReadonlySet<string>
  incoming: ReadonlyMap<string, readonly FlowGraphEdge[]>
  plannedExecutableNodeIds: ReadonlySet<string>
}) {
  return Object.fromEntries(
    [...input.plannedExecutableNodeIds].toSorted().map((nodeId) => {
      const dependencies = new Set<string>()
      const visited = new Set<string>()
      const queue = (input.incoming.get(nodeId) ?? [])
        .map(edge => edge.sourceNodeId)
        .toSorted()
      while (queue.length > 0) {
        const sourceNodeId = queue.shift()!
        if (visited.has(sourceNodeId))
          continue
        visited.add(sourceNodeId)
        if (input.executableNodeIds.has(sourceNodeId)) {
          if (input.plannedExecutableNodeIds.has(sourceNodeId))
            dependencies.add(sourceNodeId)
          continue
        }
        queue.push(...(input.incoming.get(sourceNodeId) ?? [])
          .map(edge => edge.sourceNodeId))
        queue.sort()
      }
      return [nodeId, Object.freeze([...dependencies].toSorted())]
    }),
  )
}
