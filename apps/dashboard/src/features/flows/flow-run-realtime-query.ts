import type { QueryClient } from '@tanstack/react-query'
import { flowQueryKeys } from './flow-query-keys'

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

export function millisecondsUntilFlowRunTokenRefresh(
  expiresAt: string | undefined,
) {
  if (!expiresAt)
    return 10_000
  const refreshAt = new Date(expiresAt).getTime() - 60_000
  const delay = refreshAt - Date.now()
  return Math.max(30_000, delay)
}
