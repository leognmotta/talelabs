/** Asset cache lookup and list-membership rules. */

import type {
  Asset,
  AssetDetail,
  AssetListResponse,
  GetAssetsQueryParams,
} from '@talelabs/sdk'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

function includesValue<T>(filter: T | T[] | undefined, value: T) {
  return (
    filter === undefined
    || (Array.isArray(filter) ? filter.includes(value) : filter === value)
  )
}

/** Reports whether an Asset belongs in a list cache with the given API filters. */
export function assetMatchesFilters(asset: Asset, filters: GetAssetsQueryParams) {
  const expectedLifecycle = filters.archived ? 'archived' : 'live'
  if (asset.lifecycle !== expectedLifecycle)
    return false

  if (
    !includesValue(filters.type, asset.type)
    || (filters.source && filters.source !== asset.source)
  ) {
    return false
  }

  if (filters.folderId === 'root' && asset.folderId !== null)
    return false
  if (
    filters.folderId
    && filters.folderId !== 'root'
    && filters.folderId !== asset.folderId
  ) {
    return false
  }

  if (filters.favorite && !asset.favorite)
    return false

  const tagIds = filters.tagId
    ? Array.isArray(filters.tagId)
      ? filters.tagId
      : [filters.tagId]
    : []
  if (tagIds.length > 0 && !asset.tags.some(tag => tagIds.includes(tag.id)))
    return false

  return (
    !filters.search
    || asset.name.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase())
  )
}

/** Finds an Asset in detail cache first, then in any cached library page. */
export function findAssetInCache(
  queryClient: QueryClient,
  organizationId: string,
  assetId: string,
) {
  const detail = queryClient.getQueryData<AssetDetail>(
    assetQueryKeys.detail(organizationId, assetId),
  )
  if (detail)
    return detail

  const lists = queryClient.getQueriesData<InfiniteData<AssetListResponse>>({
    queryKey: assetQueryKeys.lists(organizationId),
  })

  for (const [, data] of lists) {
    for (const page of data?.pages ?? []) {
      const asset = page.data.find(item => item.id === assetId)
      if (asset)
        return asset
    }
  }

  return undefined
}
