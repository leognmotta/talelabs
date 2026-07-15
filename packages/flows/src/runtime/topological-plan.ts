import type { FlowGraphEdge } from '../types.js'
import type { FlowRunPlanningIssue } from './run-command.js'

export interface FlowRunTopologicalPlan {
  issues: readonly FlowRunPlanningIssue[]
  levels: readonly (readonly string[])[]
}

/** Returns one deterministic directed cycle from the saved graph, if present. */
export function findFlowGraphCycleNodeIds(input: {
  edges: readonly FlowGraphEdge[]
  nodeIds: ReadonlySet<string>
}): string[] {
  const outgoing = new Map<string, string[]>()
  for (const edge of input.edges) {
    if (!input.nodeIds.has(edge.sourceNodeId) || !input.nodeIds.has(edge.targetNodeId))
      continue
    outgoing.set(edge.sourceNodeId, [
      ...(outgoing.get(edge.sourceNodeId) ?? []),
      edge.targetNodeId,
    ])
  }
  for (const [nodeId, targets] of outgoing)
    outgoing.set(nodeId, [...new Set(targets)].toSorted())

  const visited = new Set<string>()
  const active = new Set<string>()
  const stack: string[] = []
  const visit = (nodeId: string): string[] => {
    if (active.has(nodeId)) {
      const start = stack.indexOf(nodeId)
      return [...stack.slice(start), nodeId]
    }
    if (visited.has(nodeId))
      return []
    visited.add(nodeId)
    active.add(nodeId)
    stack.push(nodeId)
    for (const targetId of outgoing.get(nodeId) ?? []) {
      const cycle = visit(targetId)
      if (cycle.length > 0)
        return cycle
    }
    stack.pop()
    active.delete(nodeId)
    return []
  }

  for (const nodeId of [...input.nodeIds].toSorted()) {
    const cycle = visit(nodeId)
    if (cycle.length > 0)
      return cycle
  }
  return []
}

/** Kahn ordering with stable persisted node IDs as the only tie-breaker. */
export function createFlowRunTopologicalPlan(input: {
  dependenciesByNodeId: Readonly<Record<string, readonly string[]>>
  maximumDepth: number
}): FlowRunTopologicalPlan {
  const nodeIds = Object.keys(input.dependenciesByNodeId).toSorted()
  const knownNodeIds = new Set(nodeIds)
  const incomingCount = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  const issues: FlowRunPlanningIssue[] = []

  for (const nodeId of nodeIds) {
    const dependencies = input.dependenciesByNodeId[nodeId] ?? []
    const knownDependencies = dependencies.filter(dependencyId =>
      knownNodeIds.has(dependencyId))
    incomingCount.set(nodeId, knownDependencies.length)
    for (const dependencyId of knownDependencies) {
      outgoing.set(dependencyId, [
        ...(outgoing.get(dependencyId) ?? []),
        nodeId,
      ])
    }
  }

  let ready = nodeIds.filter(nodeId => incomingCount.get(nodeId) === 0)
  const levels: string[][] = []
  const visited = new Set<string>()
  while (ready.length > 0) {
    const level = [...ready].toSorted()
    levels.push(level)
    const next = new Set<string>()
    for (const nodeId of level) {
      visited.add(nodeId)
      for (const targetId of (outgoing.get(nodeId) ?? []).toSorted()) {
        const remaining = (incomingCount.get(targetId) ?? 0) - 1
        incomingCount.set(targetId, remaining)
        if (remaining === 0)
          next.add(targetId)
      }
    }
    ready = [...next].toSorted()
  }

  if (visited.size !== nodeIds.length) {
    const cycleNodeIds = nodeIds.filter(nodeId => !visited.has(nodeId))
    issues.push({
      code: 'executable_cycle',
      field: 'graph',
      params: { nodeIds: cycleNodeIds.join(',') },
    })
  }
  if (levels.length > input.maximumDepth) {
    issues.push({
      code: 'run_topological_depth_limit',
      field: 'graph',
      params: { maximum: input.maximumDepth },
    })
  }

  return Object.freeze({
    issues: Object.freeze(issues),
    levels: Object.freeze(levels.map(level => Object.freeze(level))),
  })
}
