import type { FlowRunPlanningResult } from './planner-contracts.js'
import type { FlowRunPlanningIssue } from './run-command.js'
import { compareFlowRunPlanningIssues } from './run-command.js'

export function flowRunPlanningFailure(
  issues: readonly FlowRunPlanningIssue[],
): FlowRunPlanningResult {
  const unique = new Map<string, FlowRunPlanningIssue>()
  for (const issue of issues) {
    const key = [issue.field, issue.code, issue.nodeId ?? '', issue.slotId ?? '']
      .join('\u0000')
    if (!unique.has(key))
      unique.set(key, issue)
  }
  return {
    issues: Object.freeze(
      [...unique.values()].toSorted(compareFlowRunPlanningIssues),
    ),
    ok: false,
  }
}

export function flowGraphPlanningIssues(input: {
  issues: readonly {
    code: string
    field: string
    params?: Readonly<Record<string, boolean | number | string>>
  }[]
}) {
  return input.issues.map(issue => ({
    code: issue.code,
    field: issue.field,
    ...(issue.params ? { params: issue.params } : {}),
  })) satisfies FlowRunPlanningIssue[]
}
