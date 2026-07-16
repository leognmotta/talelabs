import type { FlowGraphEdge, FlowGraphNode } from '../../graph/types.js'
import type { FlowRunPlanningIssue } from './run-command.js'

export function planningIssueNodeId(
  issue: FlowRunPlanningIssue,
  nodes: readonly FlowGraphNode[],
  nodesById: ReadonlyMap<string, FlowGraphNode>,
) {
  const match = /^nodes\.([^.]+)/.exec(issue.field)
  if (!match)
    return undefined
  const segment = match[1]!
  if (nodesById.has(segment))
    return segment
  const index = Number.parseInt(segment, 10)
  return Number.isSafeInteger(index) ? nodes[index]?.id : undefined
}

export function planningIssueEdgeId(
  issue: FlowRunPlanningIssue,
  edges: readonly FlowGraphEdge[],
) {
  const match = /^edges\.([^.]+)/.exec(issue.field)
  if (!match)
    return undefined
  const index = Number.parseInt(match[1]!, 10)
  return Number.isSafeInteger(index) ? edges[index]?.id : undefined
}

export function isPlanningIssueRelevantToSelection(input: {
  capturedEdgeIds: ReadonlySet<string>
  capturedNodeIds: ReadonlySet<string>
  edges: readonly FlowGraphEdge[]
  issue: FlowRunPlanningIssue
  nodes: readonly FlowGraphNode[]
  nodesById: ReadonlyMap<string, FlowGraphNode>
}) {
  const nodeId = planningIssueNodeId(input.issue, input.nodes, input.nodesById)
  if (nodeId)
    return input.capturedNodeIds.has(nodeId)
  const edgeId = planningIssueEdgeId(input.issue, input.edges)
  if (edgeId)
    return input.capturedEdgeIds.has(edgeId)
  return true
}
