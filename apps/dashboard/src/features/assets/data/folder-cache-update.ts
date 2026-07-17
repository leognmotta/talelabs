/** Direct folder-cache updates for create, rename, move, and count changes. */

import type { Folder, FolderListResponse } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

/** Inserts or replaces a folder in the initialized folder-tree cache. */
export function upsertFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  folder: Folder,
) {
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    (current) => {
      if (!current)
        return { data: [folder] }

      const exists = current.data.some(item => item.id === folder.id)
      return {
        data: exists
          ? current.data.map(item => (item.id === folder.id ? folder : item))
          : [...current.data, folder],
      }
    },
  )
}

/** Applies a partial folder update to the initialized tree cache. */
export function patchFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  folderId: string,
  patch: Partial<Folder>,
) {
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    current =>
      current
        ? {
            data: current.data.map(folder =>
              folder.id === folderId ? { ...folder, ...patch } : folder,
            ),
          }
        : current,
  )
}

/** Adjusts one folder's direct-item count without allowing a negative value. */
export function adjustFolderItemCountCache(
  queryClient: QueryClient,
  organizationId: string,
  folderId: string,
  delta: number,
) {
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    current =>
      current
        ? {
            data: current.data.map(folder =>
              folder.id === folderId
                ? {
                    ...folder,
                    itemCount: Math.max(0, folder.itemCount + delta),
                  }
                : folder,
            ),
          }
        : current,
  )
}
