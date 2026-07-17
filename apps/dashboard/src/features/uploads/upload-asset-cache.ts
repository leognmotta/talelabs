/** TanStack Query reconciliation after a canonical Asset registration commits. */

import type { QueryClient } from '@tanstack/react-query'

import { invalidateAssetCache } from '../assets/data/asset-cache-snapshot'
import { upsertAssetCache } from '../assets/data/asset-cache-upsert'
import { invalidateFolderCache } from '../assets/data/folder-cache-snapshot'

/** Binds post-registration Asset and folder invalidation to one QueryClient. */
export function createAssetRegisteredCacheHandler(queryClient: QueryClient) {
  return async function assetRegistered(
    organizationId: string,
    asset: Parameters<typeof upsertAssetCache>[2],
  ) {
    upsertAssetCache(queryClient, organizationId, asset)
    await Promise.all([
      invalidateAssetCache(queryClient, organizationId, 'none'),
      invalidateFolderCache(queryClient, organizationId),
    ])
  }
}
