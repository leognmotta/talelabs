/** Folder cache snapshots, rollback restoration, and invalidation. */

import type { FolderListResponse } from '@talelabs/sdk'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

/** Every scoped folder-cache value captured before an optimistic mutation. */
export type FolderCacheSnapshot = Array<[
  QueryKey,
  FolderListResponse | undefined,
]>

/** Captures every global and Project folder tree before a mutation. */
export function snapshotFolderCache(
  queryClient: QueryClient,
  organizationId: string,
): FolderCacheSnapshot {
  return queryClient.getQueriesData<FolderListResponse>({
    queryKey: assetQueryKeys.folderScope(organizationId),
  })
}

/** Finds one folder in any captured projection without duplicating rows. */
export function findFolderInCacheSnapshot(
  snapshot: FolderCacheSnapshot,
  folderId: string,
) {
  for (const [, data] of snapshot) {
    const folder = data?.data.find(item => item.id === folderId)
    if (folder)
      return folder
  }
  return undefined
}

/** Merges captured projections into one folder metadata set. */
export function foldersInCacheSnapshot(snapshot: FolderCacheSnapshot) {
  const folders = new Map<string, FolderListResponse['data'][number]>()
  for (const [, data] of snapshot) {
    for (const folder of data?.data ?? [])
      folders.set(folder.id, folder)
  }
  return [...folders.values()]
}

/** Restores all folder-tree cache values captured before a mutation. */
export function restoreFolderCache(
  queryClient: QueryClient,
  snapshot?: FolderCacheSnapshot,
) {
  for (const [queryKey, data] of snapshot ?? [])
    queryClient.setQueryData(queryKey, data)
}

/** Invalidates the organization folder query after mutation settlement. */
export function invalidateFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  refetchType: 'active' | 'none' = 'active',
) {
  return queryClient.invalidateQueries({
    queryKey: assetQueryKeys.folderScope(organizationId),
    refetchType,
  })
}
