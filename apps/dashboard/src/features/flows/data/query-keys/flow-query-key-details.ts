/** Query-key hierarchy for Flow details and persisted graph documents. */

import { flowScope } from './flow-query-key-scope'

/** Prefix matching every Flow detail in the organization. */
export function flowDetails(organizationId: null | string) {
  return [...flowScope(organizationId), 'detail'] as const
}

/** Key for one Flow's metadata and current revision. */
export function flowDetail(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowDetails(organizationId), flowId] as const
}

/** Key for one Flow's persisted graph at its current revision. */
export function flowGraph(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowScope(organizationId), 'graph', flowId] as const
}
