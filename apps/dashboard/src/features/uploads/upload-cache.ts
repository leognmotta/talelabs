import type { Asset, Folder } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'

import { postFolders } from '@talelabs/sdk'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { invalidateAssetCache, upsertAssetCache } from '../assets/asset-query-cache'
import { assetQueryKeys } from '../assets/asset-query-keys'
import { invalidateFolderCache, upsertFolderCache } from '../assets/folder-query-cache'
import { elementQueryKeys } from '../elements/element-query-keys'

export interface UploadCacheAdapter {
  assetRegistered: (organizationId: string, asset: Asset) => Promise<void>
  createFolder: (
    organizationId: string,
    input: { name: string, parentId: null | string },
    signal: AbortSignal,
  ) => Promise<Folder>
  elementLinked: (organizationId: string, elementId: string) => Promise<void>
}

export function createUploadCacheAdapter(
  queryClient: QueryClient,
): UploadCacheAdapter {
  return {
    async assetRegistered(organizationId, asset) {
      upsertAssetCache(queryClient, organizationId, asset)
      await Promise.all([
        invalidateAssetCache(queryClient, organizationId, 'none'),
        invalidateFolderCache(queryClient, organizationId),
      ])
    },
    async createFolder(organizationId, input, signal) {
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
    },
    async elementLinked(organizationId, elementId) {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: elementQueryKeys.detail(organizationId, elementId),
        }),
        queryClient.invalidateQueries({
          queryKey: elementQueryKeys.kit(organizationId, elementId),
        }),
        queryClient.invalidateQueries({
          queryKey: elementQueryKeys.lists(organizationId),
        }),
      ])
    },
  }
}
