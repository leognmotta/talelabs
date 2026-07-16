import type { FlowRunPlanningResult } from '../src/index.js'

export const runPlannerErrors: string[] = []

export function expectRunPlanner(condition: unknown, message: string) {
  if (!condition)
    runPlannerErrors.push(message)
}

export function expectRunPlannerSuccess(
  result: FlowRunPlanningResult,
  scenario: string,
) {
  if (!result.ok) {
    runPlannerErrors.push(
      `${scenario}: expected success, received ${result.issues.map(issue => issue.code).join(', ')}`,
    )
    return undefined
  }
  return result.plan
}

export function expectRunPlannerFailure(
  result: FlowRunPlanningResult,
  code: string,
  scenario: string,
) {
  if (result.ok) {
    runPlannerErrors.push(`${scenario}: expected ${code}, received success`)
    return
  }
  if (!result.issues.some(issue => issue.code === code)) {
    runPlannerErrors.push(
      `${scenario}: expected ${code}, received ${result.issues.map(issue => issue.code).join(', ')}`,
    )
  }
}
