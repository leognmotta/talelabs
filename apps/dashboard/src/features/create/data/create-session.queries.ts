/**
 * TanStack Query ownership for durable Create session lists and details.
 *
 * Editable drafts remain browser-local; only session identity is server state.
 */

import type { CreateSessionListResponse } from '@talelabs/sdk'
import {
  getCreateSessions,
  getCreateSessionsId,
} from '@talelabs/sdk'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { createSessionQueryKeys } from './create-session-query-keys'

const CREATE_SESSION_PAGE_SIZE = 20

/** Loads one owned session when the route carries its identity. */
export function useCreateSessionQuery(sessionId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    enabled: Boolean(organizationId && sessionId),
    queryFn: ({ signal }) => getCreateSessionsId(
      { id: sessionId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    queryKey: createSessionQueryKeys.detail(organizationId, sessionId),
    staleTime: 30_000,
  })
}

/** Loads a bounded searched session rail with explicit older-page fetching. */
export function useCreateSessionListQuery(search: string) {
  const organizationId = useActiveOrganizationId()
  return useInfiniteQuery({
    enabled: Boolean(organizationId),
    getNextPageParam: (page: CreateSessionListResponse) =>
      page.nextCursor ?? undefined,
    initialPageParam: '',
    queryFn: async ({ pageParam, signal }): Promise<CreateSessionListResponse> =>
      getCreateSessions(
        {
          params: {
            cursor: pageParam || undefined,
            limit: CREATE_SESSION_PAGE_SIZE,
            search: search || undefined,
          },
        },
        {
          headers: getOrganizationRequestHeaders(organizationId!),
          signal,
        },
      ),
    queryKey: createSessionQueryKeys.list(organizationId, search),
    staleTime: 15_000,
  })
}
