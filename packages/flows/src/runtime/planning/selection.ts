import type { FlowGraphEdge, FlowGraphNode } from '../../graph/types.js'
import type {
  FlowRunInclusionReason,
  NormalizedFlowRunCommand,
} from './run-command.js'

import { isGenerationNodeType } from '../../generation/registry/index.js'
import { compareStableStrings } from '../../graph/ordering/stable.js'
import { flowGraphAdjacency } from './selection-adjacency.js'
import {
  captureRequiredFlowGraph,
  executableDependencies,
} from './selection-capture.js'
import { selectedExecutableNodes } from './selection-executables.js'

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
  const { incoming, outgoing } = flowGraphAdjacency(nodeIds, input.edges)
  const selected = selectedExecutableNodes({
    command: input.command,
    executableNodeIds,
    incoming,
    outgoing,
  })
  const plannedExecutableNodeIds = new Set(selected.reasons.keys())
  const captured = captureRequiredFlowGraph({
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
