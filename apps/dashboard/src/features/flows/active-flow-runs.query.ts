/** Active Flow run identity query used to restore observation after navigation. */

import { getRuns } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { flowQueryKeys } from './flow-query-keys'
import { stableRunIds } from './flow-run-active-state'

const RUN_FALLBACK_REFRESH_INTERVAL_MS = 60_000

/** Loads the IDs of pending and running Flow runs for the active organization. */
export function useActiveFlowRunsQuery() {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.activeRuns(organizationId),
    queryFn: async ({ signal }) => {
      const [pending, running] = await Promise.all([
        getRuns(
          { params: { limit: 100, status: 'pending' } },
          {
            headers: getOrganizationRequestHeaders(organizationId!),
            signal,
          },
        ),
        getRuns(
          { params: { limit: 100, status: 'running' } },
          {
            headers: getOrganizationRequestHeaders(organizationId!),
            signal,
          },
        ),
      ])
      return stableRunIds([
        ...pending.data.map(run => run.id),
        ...running.data.map(run => run.id),
      ])
    },
    enabled: Boolean(organizationId),
    refetchInterval: RUN_FALLBACK_REFRESH_INTERVAL_MS,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}
