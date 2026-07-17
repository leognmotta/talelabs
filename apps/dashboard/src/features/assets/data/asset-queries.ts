/** Asset list/detail queries and their refresh policy. */

import type {
  AssetSource,
  AssetType,
  GetAssetsQueryParams,
} from '@talelabs/sdk'

import { getAssets, getAssetsId } from '@talelabs/sdk'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { assetQueryKeys } from './asset-query-keys'
import {
  ASSET_MEDIA_REFRESH_INTERVAL_MS,
  ASSET_PROCESSING_REFRESH_INTERVAL_MS,
  assetNeedsProcessingRefresh,
} from './asset-query-timing'

/** Maximum number of Assets requested for the visible library page. */
export const ASSET_LIBRARY_PAGE_SIZE = 60

/** Cursor history retained while the one-page infinite query moves backward. */
export interface AssetPageParam {
  /** Cursor used to request the current page; absent for the first page. */
  cursor?: string
  /** Earlier cursors retained so TanStack Query can request the previous page. */
  previousCursors: Array<string | undefined>
}

function isSearchTransition(
  previous: GetAssetsQueryParams | undefined,
  next: GetAssetsQueryParams,
) {
  if (!previous || previous.search === next.search)
    return false

  const { search: _previousSearch, ...previousFilters } = previous
  const { search: _nextSearch, ...nextFilters } = next
  return JSON.stringify(previousFilters) === JSON.stringify(nextFilters)
}

/**
 * Loads the current Asset-library page and preserves only search-transition
 * placeholder data within the same organization and filter scope.
 */
export function useAssetLibraryQuery(filters: {
  archived: boolean
  favorite: boolean
  folderId: null | string
  order: 'asc' | 'desc'
  search: string
  sort: 'createdAt' | 'name' | 'sizeBytes'
  source?: AssetSource
  tagId?: string
  type?: AssetType | AssetType[]
}) {
  const organizationId = useActiveOrganizationId()
  const params: GetAssetsQueryParams = {
    archived: filters.archived,
    favorite: filters.favorite || undefined,
    folderId: filters.folderId ?? 'root',
    limit: ASSET_LIBRARY_PAGE_SIZE,
    order: filters.order,
    search: filters.search || undefined,
    sort: filters.sort,
    source: filters.source,
    tagId: filters.tagId,
    type: filters.type,
  }

  return useInfiniteQuery({
    queryKey: assetQueryKeys.list(organizationId, params),
    initialPageParam: {
      cursor: undefined,
      previousCursors: [],
    } as AssetPageParam,
    queryFn: ({ pageParam, signal }) =>
      getAssets(
        {
          params: { ...params, cursor: pageParam.cursor },
        },
        {
          headers: getOrganizationRequestHeaders(organizationId!),
          signal,
        },
      ),
    getNextPageParam: (page, _pages, pageParam) => page.nextCursor
      ? {
          cursor: page.nextCursor,
          previousCursors: [
            ...pageParam.previousCursors,
            pageParam.cursor,
          ],
        }
      : undefined,
    getPreviousPageParam: (_page, _pages, pageParam) => {
      if (pageParam.previousCursors.length === 0)
        return undefined

      return {
        cursor: pageParam.previousCursors.at(-1),
        previousCursors: pageParam.previousCursors.slice(0, -1),
      }
    },
    maxPages: 1,
    enabled: Boolean(organizationId),
    placeholderData: (previousData, previousQuery) => {
      const previousOrganizationId = previousQuery?.queryKey[1]
      if (previousOrganizationId !== organizationId)
        return undefined

      const previousParams = previousQuery?.queryKey.at(-1) as
        | GetAssetsQueryParams
        | undefined
      return isSearchTransition(previousParams, params)
        ? previousData
        : undefined
    },
    refetchInterval: (query) => {
      const pages = query.state.data?.pages
      const isProcessing = pages?.some(page =>
        page.data.some(assetNeedsProcessingRefresh),
      )
      return isProcessing
        ? ASSET_PROCESSING_REFRESH_INTERVAL_MS
        : ASSET_MEDIA_REFRESH_INTERVAL_MS
    },
    refetchOnWindowFocus: true,
  })
}

/** Loads one canonical Asset and polls only while media processing is active. */
export function useAssetDetailQuery(id: null | string, enabled = true) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: assetQueryKeys.detail(organizationId, id),
    queryFn: ({ signal }) => getAssetsId(
      { id: id! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: enabled && Boolean(organizationId && id),
    refetchInterval: query => query.state.data
      && assetNeedsProcessingRefresh(query.state.data)
      ? ASSET_PROCESSING_REFRESH_INTERVAL_MS
      : ASSET_MEDIA_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}
