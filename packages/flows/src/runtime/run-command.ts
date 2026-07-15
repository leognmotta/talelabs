import { compareStableStrings } from '../stable-order.js'

export type FlowRunCommand
  = | { mode: 'all' }
    | { mode: 'downstream' | 'node' | 'upstream', targetNodeId: string }
    | { mode: 'selection', selectedNodeIds: readonly string[] }

export type FlowRunInclusionReason
  = | 'dependency'
    | 'descendant'
    | 'selected'
    | 'target'

export interface FlowRunPlanningIssue {
  code: string
  field: string
  nodeId?: string
  params?: Readonly<Record<string, boolean | number | string>>
  slotId?: string
}

export type NormalizedFlowRunCommand
  = | { mode: 'all' }
    | { mode: 'downstream' | 'node' | 'upstream', targetNodeId: string }
    | { mode: 'selection', selectedNodeIds: readonly string[] }

export function compareFlowRunPlanningIssues(
  left: FlowRunPlanningIssue,
  right: FlowRunPlanningIssue,
) {
  return compareStableStrings(left.field, right.field)
    || compareStableStrings(left.code, right.code)
    || compareStableStrings(left.nodeId ?? '', right.nodeId ?? '')
    || compareStableStrings(left.slotId ?? '', right.slotId ?? '')
}

export function normalizeFlowRunCommand(input: {
  command: FlowRunCommand
  executableNodeIds: ReadonlySet<string>
  nodeIds: ReadonlySet<string>
  selectionLimit: number
}): { command?: NormalizedFlowRunCommand, issues: FlowRunPlanningIssue[] } {
  const { command } = input
  const issues: FlowRunPlanningIssue[] = []

  if (command.mode === 'all')
    return { command, issues }

  if (command.mode !== 'selection') {
    if (!input.nodeIds.has(command.targetNodeId)) {
      issues.push({
        code: 'unknown_target_node',
        field: 'command.targetNodeId',
        nodeId: command.targetNodeId,
      })
    }
    else if (!input.executableNodeIds.has(command.targetNodeId)) {
      issues.push({
        code: 'target_not_executable',
        field: 'command.targetNodeId',
        nodeId: command.targetNodeId,
      })
    }
    return {
      ...(issues.length === 0 ? { command: { ...command } } : {}),
      issues,
    }
  }

  if (command.selectedNodeIds.length === 0) {
    issues.push({
      code: 'selection_empty',
      field: 'command.selectedNodeIds',
    })
  }
  if (command.selectedNodeIds.length > input.selectionLimit) {
    issues.push({
      code: 'run_selection_limit',
      field: 'command.selectedNodeIds',
      params: { maximum: input.selectionLimit },
    })
  }

  const selected = new Set<string>()
  for (const [index, nodeId] of command.selectedNodeIds.entries()) {
    if (selected.has(nodeId)) {
      issues.push({
        code: 'selection_duplicate_node',
        field: `command.selectedNodeIds.${index}`,
        nodeId,
      })
      continue
    }
    selected.add(nodeId)
    if (!input.nodeIds.has(nodeId)) {
      issues.push({
        code: 'selection_unknown_node',
        field: `command.selectedNodeIds.${index}`,
        nodeId,
      })
    }
  }

  const selectedExecutableCount = [...selected]
    .filter(nodeId => input.executableNodeIds.has(nodeId))
    .length
  if (selectedExecutableCount === 0) {
    issues.push({
      code: 'selection_has_no_executable_node',
      field: 'command.selectedNodeIds',
    })
  }

  return {
    ...(issues.length === 0
      ? {
          command: {
            mode: 'selection' as const,
            selectedNodeIds: Object.freeze([...selected].toSorted()),
          },
        }
      : {}),
    issues: issues.toSorted(compareFlowRunPlanningIssues),
  }
}
