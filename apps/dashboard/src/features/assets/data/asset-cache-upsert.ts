/** Ordered Asset upserts for filtered list caches and initialized details. */

import type {
  Asset,
  AssetDetail,
  AssetListResponse,
  GetAssetsQueryParams,
} from '@talelabs/sdk'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { assetMatchesFilters } from './asset-cache-lookup'
import { assetQueryKeys } from './asset-query-keys'

function compareAssets(
  left: Asset,
  right: Asset,
  filters: GetAssetsQueryParams,
) {
  const direction = filters.order === 'asc' ? 1 : -1

  if (filters.sort === 'name') {
    const result = left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
    })
    return result === 0
      ? left.id.localeCompare(right.id) * direction
      : result * direction
  }

  if (filters.sort === 'sizeBytes') {
    if (left.sizeBytes === null) {
      return right.sizeBytes === null
        ? left.id.localeCompare(right.id) * direction
        : 1
    }
    if (right.sizeBytes === null)
      return -1
    const result = left.sizeBytes - right.sizeBytes
    return result === 0
      ? left.id.localeCompare(right.id) * direction
      : result * direction
  }

  const result
    = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  return result === 0
    ? left.id.localeCompare(right.id) * direction
    : result * direction
}

/**
 * Replaces one Asset across cached list pages while preserving each query's
 * filter, sort order, and page slicing; initialized detail cache is updated too.
 */
export function upsertAssetCache(
  queryClient: QueryClient,
  organizationId: string,
  asset: Asset,
) {
  const lists = queryClient.getQueriesData<InfiniteData<AssetListResponse>>({
    queryKey: assetQueryKeys.lists(organizationId),
  })

  for (const [queryKey, data] of lists) {
    if (!data)
      continue

    const filters = queryKey.at(-1) as GetAssetsQueryParams
    const existing = data.pages
      .flatMap(page => page.data)
      .filter(item => item.id !== asset.id)
    if (assetMatchesFilters(asset, filters))
      existing.push(asset)
    existing.sort((left, right) => compareAssets(left, right, filters))

    const pageSize = filters.limit ?? 50
    queryClient.setQueryData<InfiniteData<AssetListResponse>>(queryKey, {
      ...data,
      pages: data.pages.map((page, index) => ({
        ...page,
        data: existing.slice(
          index * pageSize,
          index === data.pages.length - 1 ? undefined : (index + 1) * pageSize,
        ),
      })),
    })
  }

  queryClient.setQueryData<AssetDetail>(
    assetQueryKeys.detail(organizationId, asset.id),
    current => (current ? { ...current, ...asset } : current),
  )
}
