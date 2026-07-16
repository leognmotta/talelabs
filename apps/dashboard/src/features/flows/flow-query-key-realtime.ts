import { flowScope } from './flow-query-key-scope'

export function flowRunRealtimeToken(
  organizationId: null | string,
  runId: null | string,
) {
  return [...flowScope(organizationId), 'run', runId, 'realtime-token'] as const
}
