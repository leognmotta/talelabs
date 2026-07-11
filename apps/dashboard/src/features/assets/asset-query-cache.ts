import type {
  Asset,
  AssetDetail,
  AssetListResponse,
  GetAssetsQueryParams,
} from '@talelabs/sdk'
import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

type AssetPatch = Partial<Asset> | ((asset: Asset) => Partial<Asset>)

export interface AssetCacheSnapshot {
  details: Array<[QueryKey, AssetDetail | undefined]>
  lists: Array<[QueryKey, InfiniteData<AssetListResponse> | undefined]>
}

function includesValue<T>(filter: T | T[] | undefined, value: T) {
  return (
    filter === undefined
    || (Array.isArray(filter) ? filter.includes(value) : filter === value)
  )
}

function matchesFilters(asset: Asset, filters: GetAssetsQueryParams) {
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

function resolvePatch(asset: Asset, patch: AssetPatch) {
  return typeof patch === 'function' ? patch(asset) : patch
}

function findAssetInCache(
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

export function restoreAssetCache(
  queryClient: QueryClient,
  snapshot?: AssetCacheSnapshot,
) {
  for (const [queryKey, data] of snapshot?.lists ?? [])
    queryClient.setQueryData(queryKey, data)
  for (const [queryKey, data] of snapshot?.details ?? [])
    queryClient.setQueryData(queryKey, data)
}

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
    if (matchesFilters(asset, filters))
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
