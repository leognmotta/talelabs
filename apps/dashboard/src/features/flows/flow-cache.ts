/** Organization-scoped Flow list and detail cache transformations. */

import type { Flow, FlowListResponse } from '@talelabs/sdk'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { flowQueryKeys } from './flow-query-keys'

/** Returns whether the organization still owns any Flow cache entries. */
export function hasOrganizationScopeCache(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.getQueryCache().findAll({
    queryKey: flowQueryKeys.scope(organizationId),
  }).length > 0
}

/** Applies one partial Flow update across every cached list page. */
export function patchFlowLists(
  queryClient: QueryClient,
  organizationId: string,
  flowId: string,
  patch: Partial<Flow>,
) {
  queryClient.setQueriesData<InfiniteData<FlowListResponse>>(
    { queryKey: flowQueryKeys.lists(organizationId) },
    current => current
      ? {
          ...current,
          pages: current.pages.map(page => ({
            ...page,
            data: page.data.map(flow => (
              flow.id === flowId ? { ...flow, ...patch } : flow
            )),
          })),
        }
      : current,
  )
}

/** Removes one Flow from every cached list page. */
export function removeFlowFromLists(
  queryClient: QueryClient,
  organizationId: string,
  flowId: string,
) {
  queryClient.setQueriesData<InfiniteData<FlowListResponse>>(
    { queryKey: flowQueryKeys.lists(organizationId) },
    current => current
      ? {
          ...current,
          pages: current.pages.map(page => ({
            ...page,
            data: page.data.filter(flow => flow.id !== flowId),
          })),
        }
      : current,
  )
}
