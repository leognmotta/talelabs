/** Query key for organization-scoped realtime subscription tokens. */

import { flowScope } from './flow-query-key-scope'

/** Key for one run's short-lived realtime subscription token. */
export function flowRunRealtimeToken(
  organizationId: null | string,
  runId: null | string,
) {
  return [...flowScope(organizationId), 'run', runId, 'realtime-token'] as const
}
