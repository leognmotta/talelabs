/** Folder server-state query and processing refresh policy. */

import { getFolders } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { assetQueryKeys } from './asset-query-keys'
import {
  ASSET_MEDIA_REFRESH_INTERVAL_MS,
  ASSET_PROCESSING_REFRESH_INTERVAL_MS,
} from './asset-query-timing'

/** Loads the organization folder tree and polls while it contains processing Assets. */
export function useFoldersQuery(enabled = true) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: assetQueryKeys.folders(organizationId),
    queryFn: ({ signal }) => getFolders({
      headers: getOrganizationRequestHeaders(organizationId!),
      signal,
    }),
    enabled: enabled && Boolean(organizationId),
    staleTime: 60_000,
    refetchInterval: query => query.state.data?.data.some(
      folder => folder.processingItemCount > 0,
    )
      ? ASSET_PROCESSING_REFRESH_INTERVAL_MS
      : ASSET_MEDIA_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}
