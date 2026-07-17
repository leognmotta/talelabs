/** Tag server-state query for Asset classification controls. */

import { getTags } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { assetQueryKeys } from './asset-query-keys'

/** Loads the organization's stable tag list when its consuming UI is active. */
export function useTagsQuery(enabled = true) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: assetQueryKeys.tags(organizationId),
    queryFn: ({ signal }) => getTags({
      headers: getOrganizationRequestHeaders(organizationId!),
      signal,
    }),
    enabled: enabled && Boolean(organizationId),
    staleTime: 60_000,
  })
}
