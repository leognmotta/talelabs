/** Compact Project folder-tree server-state query for contextual navigation. */

import { getFoldersTree } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { assetQueryKeys } from '../../assets/data/asset-query-keys'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'

/** Loads hierarchy and direct counts without Asset previews or media polling. */
export function useProjectFolderTreeQuery(
  enabled: boolean,
  projectId: string,
) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    enabled: enabled && Boolean(organizationId),
    queryFn: ({ signal }) => getFoldersTree(
      { params: { projectId } },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    queryKey: assetQueryKeys.projectFolderTree(organizationId, projectId),
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  })
}
