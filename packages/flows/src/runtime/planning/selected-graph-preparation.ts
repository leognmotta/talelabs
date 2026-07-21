/**
 * Selection, validation, topology, and capture preparation for Flow runs.
 *
 * This stage turns one mutable Flow draft plus run command into a bounded,
 * validated selected graph. Later stages never repeat selection decisions.
 */

import type { FlowGraphEdge, FlowGraphNode } from '../../graph/types.js'
import type { FlowRunLimits } from './limits.js'
import type {
  FlowRunPlannerInput,
  FlowRunPlanningStageResult,
} from './planner-contracts.js'
import type {
  FlowRunPlanningIssue,
  NormalizedFlowRunCommand,
} from './run-command.js'
import type {
  FlowRunGraphSelection,
  FlowRunGraphSelectionIndex,
} from './selection.js'

import { isGenerationNodeType } from '../../generation/registry/index.js'
import { compareFlowEdgesByPriority } from '../../graph/ordering/edges.js'
import {
  validateExecutableFlowGraph,
  validateFlowGraphDraft,
} from '../../graph/validation.js'
import { resolveFlowRunLimits } from './limits.js'
import { isPlanningIssueRelevantToSelection } from './planner-issue-scope.js'
import { flowGraphPlanningIssues } from './planner-result.js'
import { normalizeFlowRunCommand } from './run-command.js'
import { selectFlowRunGraph } from './selection.js'
import {
  createFlowRunTopologicalPlan,
  findFlowGraphCycleNodeIds,
} from './topology.js'

/** Validated selected graph consumed by execution materialization. */
export interface PreparedSelectedGraph {
  capturedEdges: readonly FlowGraphEdge[]
  command: NormalizedFlowRunCommand
  input: FlowRunPlannerInput
  limits: FlowRunLimits
  nodesById: ReadonlyMap<string, FlowGraphNode>
  plannedExecutableIds: ReadonlySet<string>
  selection: FlowRunGraphSelection
  topologicalLevels: readonly (readonly string[])[]
}

/**
 * Selects, validates, and topologically orders the exact graph captured by a
 * Flow run command.
 */
export function prepareSelectedFlowRunGraph(
  input: FlowRunPlannerInput,
  selectionIndex?: FlowRunGraphSelectionIndex,
): FlowRunPlanningStageResult<PreparedSelectedGraph> {
  const limits = resolveFlowRunLimits(input.limits)
  const draftValidation = validateFlowGraphDraft({
    context: input.context,
    edges: input.flow.edges,
    nodes: input.flow.nodes,
  })
  const normalizedNodes = draftValidation.nodes
  const nodesById = new Map(normalizedNodes.map(node => [node.id, node]))
  const nodeIds = new Set(nodesById.keys())
  const executableNodeIds = new Set(
    normalizedNodes
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id),
  )
  const normalizedCommand = normalizeFlowRunCommand({
    command: input.command,
    executableNodeIds,
    nodeIds,
    selectionLimit: limits.selectionIds,
  })
  if (!normalizedCommand.command)
    return { issues: normalizedCommand.issues, ok: false }

  const selection = selectFlowRunGraph({
    command: normalizedCommand.command,
    edges: input.flow.edges,
    index: selectionIndex,
    nodes: normalizedNodes,
  })
  const capturedNodeIds = new Set(selection.capturedNodeIds)
  const capturedEdgeIds = new Set(selection.capturedEdgeIds)
  const selectedDraftIssues = flowGraphPlanningIssues(draftValidation).filter(issue =>
    isPlanningIssueRelevantToSelection({
      capturedEdgeIds,
      capturedNodeIds,
      edges: input.flow.edges,
      issue,
      nodes: normalizedNodes,
      nodesById,
    }))
  if (selectedDraftIssues.length > 0)
    return { issues: selectedDraftIssues, ok: false }

  const cycleNodeIds = findFlowGraphCycleNodeIds({
    edges: input.flow.edges,
    nodeIds: normalizedCommand.command.mode === 'all'
      ? nodeIds
      : capturedNodeIds,
  })
  if (cycleNodeIds.length > 0) {
    return {
      issues: [{
        code: 'executable_cycle',
        field: 'graph',
        params: { nodeIds: cycleNodeIds.join(',') },
      }],
      ok: false,
    }
  }

  const plannedExecutableIds = new Set(
    selection.executableNodes.map(node => node.nodeId),
  )
  const issues: FlowRunPlanningIssue[] = []
  if (plannedExecutableIds.size > limits.executableNodes) {
    issues.push({
      code: 'run_executable_node_limit',
      field: 'graph',
      params: { maximum: limits.executableNodes },
    })
  }
  const executableValidation = validateExecutableFlowGraph({
    context: input.context,
    edges: input.flow.edges.filter(edge => capturedEdgeIds.has(edge.id)),
    nodes: normalizedNodes,
  }, plannedExecutableIds)
  issues.push(...flowGraphPlanningIssues(executableValidation))

  const topological = createFlowRunTopologicalPlan({
    dependenciesByNodeId: selection.dependenciesByNodeId,
    maximumDepth: limits.topologicalDepth,
  })
  issues.push(...topological.issues)
  if (issues.length > 0)
    return { issues, ok: false }

  const edgeById = new Map(input.flow.edges.map(edge => [edge.id, edge]))
  const capturedEdges = selection.capturedEdgeIds
    .map(edgeId => edgeById.get(edgeId))
    .filter((edge): edge is FlowGraphEdge => Boolean(edge))
    .toSorted(compareFlowEdgesByPriority)

  return {
    ok: true,
    value: Object.freeze({
      capturedEdges: Object.freeze(capturedEdges),
      command: normalizedCommand.command,
      input,
      limits,
      nodesById,
      plannedExecutableIds,
      selection,
      topologicalLevels: topological.levels,
    }),
  }
}
