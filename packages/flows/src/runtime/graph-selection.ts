import type { FlowGraphEdge, FlowGraphNode } from '../types.js'
import type {
  FlowRunInclusionReason,
  NormalizedFlowRunCommand,
} from './run-command.js'

import { compareFlowEdgesByPriority } from '../edge-ordering.js'
import { isGenerationNodeType } from '../generation-registry.js'
import { compareStableStrings } from '../stable-order.js'

export interface FlowRunSelectedNode {
  inclusionReason: FlowRunInclusionReason
  nodeId: string
}

export interface FlowRunGraphSelection {
  capturedEdgeIds: readonly string[]
  capturedNodeIds: readonly string[]
  dependenciesByNodeId: Readonly<Record<string, readonly string[]>>
  executableNodes: readonly FlowRunSelectedNode[]
  requestedExecutableCount: number
}

function adjacency(
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

function reachableNodeIds(
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

function selectedExecutables(input: {
  command: NormalizedFlowRunCommand
  executableNodeIds: ReadonlySet<string>
  incoming: ReadonlyMap<string, readonly FlowGraphEdge[]>
  outgoing: ReadonlyMap<string, readonly FlowGraphEdge[]>
}) {
  const reasons = new Map<string, FlowRunInclusionReason>()
  const command = input.command

  if (command.mode === 'all') {
    for (const nodeId of input.executableNodeIds)
      reasons.set(nodeId, 'selected')
    return { reasons, requestedExecutableCount: input.executableNodeIds.size }
  }

  if (command.mode === 'node') {
    reasons.set(command.targetNodeId, 'target')
    return { reasons, requestedExecutableCount: 1 }
  }

  if (command.mode === 'downstream') {
    const reachable = reachableNodeIds(
      [command.targetNodeId],
      input.outgoing,
      edge => edge.targetNodeId,
    )
    for (const nodeId of reachable) {
      if (input.executableNodeIds.has(nodeId)) {
        reasons.set(
          nodeId,
          nodeId === command.targetNodeId ? 'target' : 'descendant',
        )
      }
    }
    return { reasons, requestedExecutableCount: 1 }
  }

  if (command.mode === 'selection') {
    const roots = command.selectedNodeIds.filter(nodeId =>
      input.executableNodeIds.has(nodeId))
    for (const nodeId of roots)
      reasons.set(nodeId, 'selected')
    return { reasons, requestedExecutableCount: roots.length }
  }

  const roots = [command.targetNodeId]
  const reachable = reachableNodeIds(
    roots,
    input.incoming,
    edge => edge.sourceNodeId,
  )
  for (const nodeId of reachable) {
    if (!input.executableNodeIds.has(nodeId))
      continue
    reasons.set(
      nodeId,
      roots.includes(nodeId) ? 'target' : 'dependency',
    )
  }
  return { reasons, requestedExecutableCount: roots.length }
}

function captureRequiredGraph(input: {
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

function executableDependencies(input: {
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

export function selectFlowRunGraph(input: {
  command: NormalizedFlowRunCommand
  edges: readonly FlowGraphEdge[]
  nodes: readonly FlowGraphNode[]
}): FlowRunGraphSelection {
  const nodeIds = new Set(input.nodes.map(node => node.id))
  const executableNodeIds = new Set(
    input.nodes
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id),
  )
  const { incoming, outgoing } = adjacency(nodeIds, input.edges)
  const selected = selectedExecutables({
    command: input.command,
    executableNodeIds,
    incoming,
    outgoing,
  })
  const plannedExecutableNodeIds = new Set(selected.reasons.keys())
  const captured = captureRequiredGraph({
    executableNodeIds,
    incoming,
    plannedExecutableNodeIds,
  })
  const dependenciesByNodeId = executableDependencies({
    executableNodeIds,
    incoming,
    plannedExecutableNodeIds,
  })

  return Object.freeze({
    capturedEdgeIds: Object.freeze([...captured.capturedEdgeIds].toSorted()),
    capturedNodeIds: Object.freeze([...captured.capturedNodeIds].toSorted()),
    dependenciesByNodeId: Object.freeze(dependenciesByNodeId),
    executableNodes: Object.freeze(
      [...selected.reasons]
        .toSorted(([left], [right]) => compareStableStrings(left, right))
        .map(([nodeId, inclusionReason]) => ({ inclusionReason, nodeId })),
    ),
    requestedExecutableCount: selected.requestedExecutableCount,
  })
}
