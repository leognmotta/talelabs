/** Organization and list roots shared by all Flow server-state query keys. */

import type { GetFlowsQueryParams } from '@talelabs/sdk'
import { organizationQueryKeys } from '../../../organizations/organization-query-keys'

/** Root cache scope for all Flow server state in one organization. */
export function flowScope(organizationId: null | string) {
  return [
    ...organizationQueryKeys.scope(organizationId),
    'flows',
  ] as const
}

/** Prefix matching every paginated Flow list in the organization. */
export function flowLists(organizationId: null | string) {
  return [...flowScope(organizationId), 'list'] as const
}

/** Key for one Flow list filter and pagination state. */
export function flowList(
  organizationId: null | string,
  params: GetFlowsQueryParams,
) {
  return [...flowLists(organizationId), params] as const
}
