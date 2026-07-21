/** Indexed graph-scope selection and immutable capture contracts for runs. */

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

/** Reusable graph facts shared by several selections of one exact graph. */
export interface FlowRunGraphSelectionIndex {
  /** Generation-node identities eligible for execution. */
  executableNodeIds: ReadonlySet<string>
  /** Incoming edges keyed by their target node. */
  incoming: ReadonlyMap<string, readonly FlowGraphEdge[]>
  /** Every node identity in the indexed graph. */
  nodeIds: ReadonlySet<string>
  /** Outgoing edges keyed by their source node. */
  outgoing: ReadonlyMap<string, readonly FlowGraphEdge[]>
}

/** One executable node selected for a run and why it was included. */
export interface FlowRunSelectedNode {
  /** Command-relative reason the node belongs to the selected run scope. */
  inclusionReason: FlowRunInclusionReason
  /** Stable Flow node identity. */
  nodeId: string
}

/** Captured graph closure and executable dependency projection for one scope. */
export interface FlowRunGraphSelection {
  /** Stable identities of edges required by the captured node closure. */
  capturedEdgeIds: readonly string[]
  /** Stable identities of every executable and supporting captured node. */
  capturedNodeIds: readonly string[]
  /** Planned executable ancestors keyed by their consuming executable node. */
  dependenciesByNodeId: Readonly<Record<string, readonly string[]>>
  /** Executable nodes included by the normalized command. */
  executableNodes: readonly FlowRunSelectedNode[]
  /** Direct executable targets requested before dependency expansion. */
  requestedExecutableCount: number
}

/**
 * Builds immutable lookup structures once for several run scopes over the
 * same exact graph revision.
 */
export function createFlowRunGraphSelectionIndex(input: {
  /** Graph edges whose valid endpoints are indexed. */
  edges: readonly FlowGraphEdge[]
  /** Graph nodes defining valid and executable identities. */
  nodes: readonly FlowGraphNode[]
}): FlowRunGraphSelectionIndex {
  const nodeIds = new Set(input.nodes.map(node => node.id))
  const executableNodeIds = new Set(
    input.nodes
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id),
  )
  const { incoming, outgoing } = flowGraphAdjacency(nodeIds, input.edges)
  return Object.freeze({
    executableNodeIds,
    incoming,
    nodeIds,
    outgoing,
  })
}

/** Selects the captured and executable nodes for one normalized run command. */
export function selectFlowRunGraph(input: {
  command: NormalizedFlowRunCommand
  edges: readonly FlowGraphEdge[]
  /** Optional index created from these exact nodes and edges. */
  index?: FlowRunGraphSelectionIndex
  nodes: readonly FlowGraphNode[]
}): FlowRunGraphSelection {
  const index = input.index ?? createFlowRunGraphSelectionIndex(input)
  const selected = selectedExecutableNodes({
    command: input.command,
    executableNodeIds: index.executableNodeIds,
    incoming: index.incoming,
    outgoing: index.outgoing,
  })
  const plannedExecutableNodeIds = new Set(selected.reasons.keys())
  const captured = captureRequiredFlowGraph({
    executableNodeIds: index.executableNodeIds,
    incoming: index.incoming,
    plannedExecutableNodeIds,
  })
  const dependenciesByNodeId = executableDependencies({
    executableNodeIds: index.executableNodeIds,
    incoming: index.incoming,
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
