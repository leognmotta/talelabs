import type { GetFlowsQueryParams } from '@talelabs/sdk'
import { organizationQueryKeys } from '../organizations/organization-query-keys'

export function flowScope(organizationId: null | string) {
  return [
    ...organizationQueryKeys.scope(organizationId),
    'flows',
  ] as const
}

export function flowLists(organizationId: null | string) {
  return [...flowScope(organizationId), 'list'] as const
}

export function flowList(
  organizationId: null | string,
  params: GetFlowsQueryParams,
) {
  return [...flowLists(organizationId), params] as const
}
