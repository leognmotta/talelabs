/** Content-compatible generation catalog query for Flow editing. */

import { GENERATION_CATALOG_REVISION } from '@talelabs/flows'
import { getConfigGeneration } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { flowQueryKeys } from '../data/query-keys/flow-query-keys'

/** Loads public generation capabilities and rejects rolling-deploy drift. */
export function useGenerationConfigQuery() {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.generationConfig(organizationId),
    queryFn: async ({ signal }) => {
      const config = await getConfigGeneration({
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      })
      if (config.catalogRevision !== GENERATION_CATALOG_REVISION) {
        throw new Error(
          `Generation catalog mismatch: dashboard=${GENERATION_CATALOG_REVISION}, api=${config.catalogRevision}`,
        )
      }
      return config
    },
    enabled: Boolean(organizationId),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60_000,
  })
}
