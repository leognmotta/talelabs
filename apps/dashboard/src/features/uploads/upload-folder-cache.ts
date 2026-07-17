/** Folder creation and cache publication for directory upload preparation. */

import type { QueryClient } from '@tanstack/react-query'

import { postFolders } from '@talelabs/sdk'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { assetQueryKeys } from '../assets/data/asset-query-keys'
import { upsertFolderCache } from '../assets/data/folder-cache-update'

/** Binds server folder creation and no-refetch invalidation to one QueryClient. */
export function createUploadFolderCacheHandler(queryClient: QueryClient) {
  return async function createFolder(
    organizationId: string,
    input: { name: string, parentId: null | string },
    signal: AbortSignal,
  ) {
    const folder = await postFolders({ data: input }, {
      headers: getOrganizationRequestHeaders(organizationId),
      signal,
    })
    upsertFolderCache(queryClient, organizationId, folder)
    await queryClient.invalidateQueries({
      queryKey: assetQueryKeys.folders(organizationId),
      refetchType: 'none',
    })
    return folder
  }
}
