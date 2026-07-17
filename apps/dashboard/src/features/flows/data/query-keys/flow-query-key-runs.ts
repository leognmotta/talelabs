/** Query-key hierarchy for Flow run lists, active runs, and run details. */

import { flowScope } from './flow-query-key-scope'

/** Prefix matching every observed run in the organization. */
export function flowRuns(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowScope(organizationId), 'runs', flowId] as const
}

/** Key for active run ids used to recover realtime subscriptions after reload. */
export function flowActiveRuns(organizationId: null | string) {
  return [...flowScope(organizationId), 'runs', 'active'] as const
}

/** Key for one durable run detail and its jobs. */
export function flowRun(
  organizationId: null | string,
  runId: null | string,
) {
  return [...flowScope(organizationId), 'run', runId, 'detail'] as const
}
