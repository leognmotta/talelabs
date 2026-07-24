/** Active Flow run identity query used to restore observation after navigation. */

import { getRunsActive } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../../organizations/organization-scope-context'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import { stableRunIds } from '../observation/flow-run-active-state'

const RUN_FALLBACK_REFRESH_INTERVAL_MS = 60_000

/**
 * Loads active run IDs and periodically rediscovers work started elsewhere.
 *
 * The bounded fallback remains active after an empty response so another tab or
 * device can start managed work without requiring local cache invalidation.
 */
export function useActiveFlowRunsQuery() {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.activeRuns(organizationId),
    queryFn: async ({ signal }) => {
      const active = await getRunsActive(
        { params: { executionRuntime: 'managed' } },
        {
          headers: getOrganizationRequestHeaders(organizationId!),
          signal,
        },
      )
      return stableRunIds(active.data.map(run => run.id))
    },
    enabled: Boolean(organizationId),
    refetchInterval: RUN_FALLBACK_REFRESH_INTERVAL_MS,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: 'always',
    staleTime: RUN_FALLBACK_REFRESH_INTERVAL_MS,
  })
}
