/**
 * Cursor-paged session history for durable direct Create runs.
 *
 * The refreshable newest page is separate from immutable archive pages so
 * realtime, focus, and reconnect never refetch already loaded archive pages.
 */

import { getRuns } from '@talelabs/sdk'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { flowQueryKeys } from '../../flows/data/query-keys/flow-query-keys'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'

const CREATE_RUN_PAGE_SIZE = 20
const ACTIVE_HISTORY_REFRESH_INTERVAL_MS = 30_000

/**
 * Loads one session's direct history behind an explicit archive cursor.
 *
 * Archive pages remain inert after loading, so the complete history stays
 * reachable without amplifying live-page invalidation or focus refreshes.
 */
export function useCreateRunHistoryQuery(createSessionId: null | string) {
  const organizationId = useActiveOrganizationId()
  const liveQuery = useQuery({
    queryKey: flowQueryKeys.createRunLiveHistory(
      organizationId,
      createSessionId,
      CREATE_RUN_PAGE_SIZE,
    ),
    queryFn: ({ signal }) => getRuns(
      {
        params: {
          limit: CREATE_RUN_PAGE_SIZE,
          createSessionId: createSessionId!,
          source: 'create',
        },
      },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: Boolean(organizationId && createSessionId),
    refetchInterval: query => query.state.data?.data.some(
      run => run.status === 'pending' || run.status === 'running',
    )
      ? ACTIVE_HISTORY_REFRESH_INTERVAL_MS
      : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
  const anchorCursor = liveQuery.data?.nextCursor ?? null
  const [requestedArchiveAnchor, setRequestedArchiveAnchor]
    = useState<null | string>(null)
  const activeArchiveAnchor = requestedArchiveAnchor === anchorCursor
    ? requestedArchiveAnchor
    : null
  const archiveQuery = useInfiniteQuery({
    queryKey: flowQueryKeys.createRunArchiveHistory(
      organizationId,
      createSessionId,
      CREATE_RUN_PAGE_SIZE,
      anchorCursor,
    ),
    initialPageParam: anchorCursor ?? '',
    queryFn: ({ pageParam, signal }) => getRuns(
      {
        params: {
          cursor: pageParam,
          createSessionId: createSessionId!,
          limit: CREATE_RUN_PAGE_SIZE,
          source: 'create',
        },
      },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(
      organizationId
      && createSessionId
      && activeArchiveAnchor,
    ),
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
  const runs = useMemo(() => {
    const summaries = [
      ...(liveQuery.data?.data ?? []),
      ...(activeArchiveAnchor
        ? archiveQuery.data?.pages.flatMap(page => page.data) ?? []
        : []),
    ]
    return [...new Map(summaries.map(run => [run.id, run])).values()]
  }, [activeArchiveAnchor, archiveQuery.data?.pages, liveQuery.data?.data])
  const loadEarlier = useCallback(async () => {
    if (!anchorCursor)
      return
    if (requestedArchiveAnchor !== anchorCursor) {
      setRequestedArchiveAnchor(anchorCursor)
      return
    }
    if (archiveQuery.isError && !archiveQuery.data) {
      await archiveQuery.refetch()
      return
    }
    await archiveQuery.fetchNextPage()
  }, [anchorCursor, archiveQuery, requestedArchiveAnchor])

  return {
    /** Whether another immutable archive cursor page can be requested. */
    hasEarlier: Boolean(anchorCursor && (
      !activeArchiveAnchor
      || archiveQuery.isPending
      || archiveQuery.isError
      || archiveQuery.hasNextPage
    )),
    /** Whether the live newest page failed to load. */
    isError: liveQuery.isError,
    /** Whether the live newest page is loading for the first time. */
    isPending: liveQuery.isPending,
    /** Loads one older immutable page without refreshing retained pages. */
    loadEarlier,
    /** Whether an explicit older-page request is in flight. */
    loadingEarlier: Boolean(activeArchiveAnchor && archiveQuery.isFetching),
    /** Newest-first deduplicated summaries across explicitly loaded pages. */
    runs,
  }
}
