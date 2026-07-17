/** Asset cache snapshots, rollback restoration, and post-mutation invalidation. */

import type { AssetDetail, AssetListResponse } from '@talelabs/sdk'
import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

/** Cached Asset list/detail data captured before an optimistic mutation. */
export interface AssetCacheSnapshot {
  /** Detail query values keyed exactly as they were stored before mutation. */
  details: Array<[QueryKey, AssetDetail | undefined]>
  /** Infinite-list query values keyed exactly as they were stored before mutation. */
  lists: Array<[QueryKey, InfiniteData<AssetListResponse> | undefined]>
}

/** Cancels Asset queries and captures the cache values needed for rollback. */
export async function snapshotAssetCache(
  queryClient: QueryClient,
  organizationId: string,
  assetIds?: string[],
): Promise<AssetCacheSnapshot> {
  await queryClient.cancelQueries({
    queryKey: assetQueryKeys.all(organizationId),
  })

  const lists = queryClient.getQueriesData<InfiniteData<AssetListResponse>>({
    queryKey: assetQueryKeys.lists(organizationId),
  })
  const details = assetIds
    ? assetIds.map(
        id =>
          [
            assetQueryKeys.detail(organizationId, id),
            queryClient.getQueryData<AssetDetail>(
              assetQueryKeys.detail(organizationId, id),
            ),
          ] satisfies [QueryKey, AssetDetail | undefined],
      )
    : queryClient.getQueriesData<AssetDetail>({
        queryKey: assetQueryKeys.details(organizationId),
      })

  return { details, lists }
}

/** Restores Asset list and detail entries captured before an optimistic update. */
export function restoreAssetCache(
  queryClient: QueryClient,
  snapshot?: AssetCacheSnapshot,
) {
  for (const [queryKey, data] of snapshot?.lists ?? [])
    queryClient.setQueryData(queryKey, data)
  for (const [queryKey, data] of snapshot?.details ?? [])
    queryClient.setQueryData(queryKey, data)
}

/** Invalidates all Asset queries for one organization after mutation settlement. */
export function invalidateAssetCache(
  queryClient: QueryClient,
  organizationId: string,
  refetchType: 'active' | 'none' = 'active',
) {
  return queryClient.invalidateQueries({
    queryKey: assetQueryKeys.all(organizationId),
    refetchType,
  })
}
