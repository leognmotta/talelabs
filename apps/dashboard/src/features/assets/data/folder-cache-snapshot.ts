/** Folder cache snapshots, rollback restoration, and invalidation. */

import type { FolderListResponse } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

/** Captures the current folder tree before an optimistic mutation. */
export function snapshotFolderCache(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.getQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
  )
}

/** Restores a previously captured folder-tree cache value. */
export function restoreFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  snapshot?: FolderListResponse,
) {
  queryClient.setQueryData(assetQueryKeys.folders(organizationId), snapshot)
}

/** Invalidates the organization folder query after mutation settlement. */
export function invalidateFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  refetchType: 'active' | 'none' = 'active',
) {
  return queryClient.invalidateQueries({
    queryKey: assetQueryKeys.folders(organizationId),
    refetchType,
  })
}
