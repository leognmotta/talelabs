/** Cursor-paginated Flow list query scoped to the active organization. */

import type { GetFlowsQueryParams } from '@talelabs/sdk'

import { getFlows } from '@talelabs/sdk'
import { useInfiniteQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { flowQueryKeys } from './query-keys/flow-query-keys'

const FLOW_PAGE_SIZE = 40

/** Loads the searchable infinite Flow list for the active organization. */
export function useFlowListQuery(search: string) {
  const organizationId = useActiveOrganizationId()
  const params: GetFlowsQueryParams = {
    limit: FLOW_PAGE_SIZE,
    search: search || undefined,
  }
  return useInfiniteQuery({
    queryKey: flowQueryKeys.list(organizationId, params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getFlows(
      { params: { ...params, cursor: pageParam } },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
    placeholderData: (previousData, previousQuery) => (
      previousQuery?.queryKey[1] === organizationId ? previousData : undefined
    ),
  })
}
