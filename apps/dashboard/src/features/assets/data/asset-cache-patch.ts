/** Targeted Asset cache patching across detail and filtered list queries. */

import type { Asset, AssetDetail, AssetListResponse } from '@talelabs/sdk'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { findAssetInCache } from './asset-cache-lookup'
import { upsertAssetCache } from './asset-cache-upsert'
import { assetQueryKeys } from './asset-query-keys'

type AssetPatch = Partial<Asset> | ((asset: Asset) => Partial<Asset>)

function resolvePatch(asset: Asset, patch: AssetPatch) {
  return typeof patch === 'function' ? patch(asset) : patch
}

/** Applies a partial update to one cached Asset wherever it is already present. */
export function patchAssetCache(
  queryClient: QueryClient,
  organizationId: string,
  assetId: string,
  patch: AssetPatch,
  fallbackAsset?: Asset,
) {
  const current
    = findAssetInCache(queryClient, organizationId, assetId) ?? fallbackAsset
  if (!current)
    return

  upsertAssetCache(queryClient, organizationId, {
    ...current,
    ...resolvePatch(current, patch),
  })
}

/** Applies one patch to every cached Asset accepted by the supplied predicate. */
export function patchMatchingAssets(
  queryClient: QueryClient,
  organizationId: string,
  predicate: (asset: Asset) => boolean,
  patch: AssetPatch,
) {
  const ids = new Set<string>()
  const lists = queryClient.getQueriesData<InfiniteData<AssetListResponse>>({
    queryKey: assetQueryKeys.lists(organizationId),
  })
  const details = queryClient.getQueriesData<AssetDetail>({
    queryKey: assetQueryKeys.details(organizationId),
  })

  for (const [, data] of lists) {
    for (const page of data?.pages ?? []) {
      for (const asset of page.data) {
        if (predicate(asset))
          ids.add(asset.id)
      }
    }
  }
  for (const [, asset] of details) {
    if (asset && predicate(asset))
      ids.add(asset.id)
  }

  for (const id of ids) patchAssetCache(queryClient, organizationId, id, patch)
}
