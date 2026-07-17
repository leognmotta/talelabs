/** Reconciles realtime run updates into the canonical TanStack Query cache. */

import type { QueryClient } from '@tanstack/react-query'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'

/** Invalidates cached flow run query after a successful server mutation. */
export function invalidateFlowRunQuery(
  queryClient: QueryClient,
  organizationId: string,
  runId: string,
) {
  return queryClient.invalidateQueries({
    exact: true,
    queryKey: flowQueryKeys.run(organizationId, runId),
  })
}

/** Invalidates cached flow run and active queries after a successful server mutation. */
export function invalidateFlowRunAndActiveQueries(
  queryClient: QueryClient,
  organizationId: string,
  runId: string,
) {
  return Promise.allSettled([
    invalidateFlowRunQuery(queryClient, organizationId, runId),
    queryClient.invalidateQueries({
      queryKey: flowQueryKeys.activeRuns(organizationId),
    }),
  ])
}

/** Computes token refresh delay with a safety window before server expiry. */
export function millisecondsUntilFlowRunTokenRefresh(
  expiresAt: string | undefined,
) {
  if (!expiresAt)
    return 10_000
  const refreshAt = new Date(expiresAt).getTime() - 60_000
  const delay = refreshAt - Date.now()
  return Math.max(30_000, delay)
}
