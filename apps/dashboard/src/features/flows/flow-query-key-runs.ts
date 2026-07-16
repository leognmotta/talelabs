import { flowScope } from './flow-query-key-scope'

export function flowRuns(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowScope(organizationId), 'runs', flowId] as const
}

export function flowActiveRuns(organizationId: null | string) {
  return [...flowScope(organizationId), 'runs', 'active'] as const
}

export function flowRun(
  organizationId: null | string,
  runId: null | string,
) {
  return [...flowScope(organizationId), 'run', runId, 'detail'] as const
}
