/** Single and batched Flow run detail fallback queries. */

import type { FlowRun } from '@talelabs/sdk'

import { getRunsId } from '@talelabs/sdk'
import { useQueries, useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../../organizations/organization-scope-context'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import { stableRunIds } from './flow-run-active-state'
import { isActiveFlowRunStatus } from './flow-run-status'

const RUN_FALLBACK_REFRESH_INTERVAL_MS = 60_000

/** Loads and refreshes one durable Flow run while it is active. */
export function useFlowRunDetailQuery(runId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.run(organizationId, runId),
    queryFn: ({ signal }) => getRunsId(
      { id: runId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: Boolean(organizationId && runId),
    refetchInterval: query => query.state.data
      && isActiveFlowRunStatus(query.state.data.status)
      ? RUN_FALLBACK_REFRESH_INTERVAL_MS
      : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}

/** Loads and independently refreshes a stable set of durable Flow runs. */
export function useFlowRunDetailQueries(runIds: readonly string[]) {
  const organizationId = useActiveOrganizationId()
  return useQueries({
    queries: stableRunIds(runIds).map(runId => ({
      queryKey: flowQueryKeys.run(organizationId, runId),
      queryFn: ({ signal }: { signal: AbortSignal }) => getRunsId(
        { id: runId },
        {
          headers: getOrganizationRequestHeaders(organizationId!),
          signal,
        },
      ),
      enabled: Boolean(organizationId),
      refetchInterval: (query: { state: { data?: FlowRun } }) => query.state.data
        && isActiveFlowRunStatus(query.state.data.status)
        ? RUN_FALLBACK_REFRESH_INTERVAL_MS
        : false,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      staleTime: 0,
    })),
  })
}
