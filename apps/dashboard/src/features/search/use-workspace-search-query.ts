import { getSearch } from '@talelabs/sdk'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { organizationQueryKeys } from '../organizations/organization-query-keys'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  GLOBAL_SEARCH_RESULT_LIMIT,
} from './search.constants'

const searchTypes = ['asset', 'element', 'folder'] as const

export const workspaceSearchQueryKeys = {
  all: (organizationId: null | string) => [
    ...organizationQueryKeys.scope(organizationId),
    'workspace-search',
  ] as const,
  query: (organizationId: null | string, query: string) => [
    ...workspaceSearchQueryKeys.all(organizationId),
    query,
    { limit: GLOBAL_SEARCH_RESULT_LIMIT, types: searchTypes },
  ] as const,
}

export function useWorkspaceSearchQuery(query: string, enabled: boolean) {
  const organizationId = useActiveOrganizationId()
  const queryClient = useQueryClient()
  const canSearch = enabled
    && Boolean(organizationId)
    && query.length >= GLOBAL_SEARCH_MIN_LENGTH

  useEffect(() => {
    if (!canSearch) {
      void queryClient.cancelQueries({
        queryKey: workspaceSearchQueryKeys.all(organizationId),
      })
    }
  }, [canSearch, organizationId, queryClient])

  return useQuery({
    queryKey: workspaceSearchQueryKeys.query(organizationId, query),
    queryFn: ({ signal }) => getSearch({
      params: {
        limit: GLOBAL_SEARCH_RESULT_LIMIT,
        q: query,
        type: [...searchTypes],
      },
    }, {
      headers: getOrganizationRequestHeaders(organizationId!),
      signal,
    }),
    enabled: canSearch,
    gcTime: 5 * 60_000,
    staleTime: 30_000,
  })
}
