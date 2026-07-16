import { flowScope } from './flow-query-key-scope'

export function flowDetails(organizationId: null | string) {
  return [...flowScope(organizationId), 'detail'] as const
}

export function flowDetail(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowDetails(organizationId), flowId] as const
}

export function flowGraph(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowScope(organizationId), 'graph', flowId] as const
}
