import type { FlowGraphEdge } from '../../graph/types.js'
import type {
  FlowRunInclusionReason,
  NormalizedFlowRunCommand,
} from './run-command.js'

import { reachableNodeIds } from './selection-adjacency.js'

export function selectedExecutableNodes(input: {
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
    reasons.set(nodeId, roots.includes(nodeId) ? 'target' : 'dependency')
  }
  return { reasons, requestedExecutableCount: roots.length }
}
