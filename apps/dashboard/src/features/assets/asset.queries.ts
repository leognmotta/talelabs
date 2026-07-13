import type {
  Asset,
  AssetSource,
  AssetType,
  GetAssetsQueryParams,
  Tag,
  TagListResponse,
} from '@talelabs/sdk'

import {
  deleteAssetsId,
  deleteAssetsIdFavorite,
  deleteAssetsIdTagsTagid,
  deleteFoldersId,
  getAssets,
  getAssetsId,
  getAssetsIdDownload,
  getFolders,
  getTags,
  patchAssetsId,
  patchFoldersId,
  postAssetsIdPurge,
  postAssetsIdRestore,
  postAssetsMove,
  postFolders,
  postTags,
  putAssetsIdFavorite,
  putAssetsIdTagsTagid,
} from '@talelabs/sdk'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import {
  invalidateAssetCache,
  patchMatchingAssets,
  restoreAssetCache,
  snapshotAssetCache,
} from './asset-query-cache'
import { assetQueryKeys } from './asset-query-keys'
import {
  ASSET_MEDIA_REFRESH_INTERVAL_MS,
  ASSET_PROCESSING_REFRESH_INTERVAL_MS,
  assetNeedsProcessingRefresh,
} from './asset-query-timing'
import {
  adjustFolderItemCountCache,
  invalidateFolderCache,
  patchFolderCache,
  removeFolderTreeCache,
  restoreFolderCache,
  snapshotFolderCache,
  upsertFolderCache,
} from './folder-query-cache'
import { optimisticAssetMutationOptions } from './use-optimistic-asset-mutation'

export { assetQueryKeys } from './asset-query-keys'

export const ASSET_LIBRARY_PAGE_SIZE = 60

export interface AssetPageParam {
  cursor?: string
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

function hasOrganizationScopeCache(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
) {
  return queryClient.getQueryCache().findAll({
    queryKey: assetQueryKeys.scope(organizationId),
  }).length > 0
}

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

export function useFoldersQuery(enabled = true) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: assetQueryKeys.folders(organizationId),
    queryFn: ({ signal }) => getFolders({
      headers: getOrganizationRequestHeaders(organizationId!),
      signal,
    }),
    enabled: enabled && Boolean(organizationId),
    staleTime: 60_000,
    refetchInterval: query => query.state.data?.data.some(
      folder => folder.processingItemCount > 0,
    )
      ? ASSET_PROCESSING_REFRESH_INTERVAL_MS
      : ASSET_MEDIA_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useTagsQuery(enabled = true) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: assetQueryKeys.tags(organizationId),
    queryFn: ({ signal }) => getTags({
      headers: getOrganizationRequestHeaders(organizationId!),
      signal,
    }),
    enabled: enabled && Boolean(organizationId),
    staleTime: 60_000,
  })
}

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

export function useAssetMutations() {
  const queryClient = useQueryClient()

  return {
    archive: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: true,
        affectsFlowReferences: true,
        mutationFn: ({ id, organizationId }: {
          id: string
          organizationId: string
        }) => deleteAssetsId(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getUpdates: ({ id }) => [{ id, patch: { lifecycle: 'archived' } }],
      }),
    ),
    download: useMutation({
      mutationFn: async ({ id, organizationId }: {
        id: string
        organizationId: string
      }) => {
        const result = await getAssetsIdDownload(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        )
        window.location.assign(result.url)
      },
    }),
    purge: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: true,
        affectsFlowReferences: true,
        mutationFn: ({ id, organizationId }: {
          id: string
          organizationId: string
        }) => postAssetsIdPurge(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: asset => [asset],
        getUpdates: ({ id }) => [
          {
            id,
            patch: {
              lifecycle: 'purging',
              thumbnailUrl: null,
              url: null,
            },
          },
        ],
      }),
    ),
    restore: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: true,
        affectsFlowReferences: true,
        mutationFn: ({ id, organizationId }: {
          id: string
          organizationId: string
        }) => postAssetsIdRestore(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: asset => [asset],
        getUpdates: ({ id }) => [{ id, patch: { lifecycle: 'live' } }],
      }),
    ),
    update: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: variables => variables.folderId !== undefined,
        affectsFlowReferences: true,
        mutationFn: ({
          folderId,
          id,
          name,
          organizationId,
        }: {
          folderId?: null | string
          id: string
          name?: string
          organizationId: string
        }) => patchAssetsId(
          { id, data: { folderId, name } },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: asset => [asset],
        getUpdates: ({ folderId, id, name }) => [{
          id,
          patch: {
            ...(folderId !== undefined ? { folderId } : {}),
            ...(name !== undefined ? { name } : {}),
          },
        }],
      }),
    ),
    move: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: true,
        getFolderMove: ({ assets, destinationFolderId }) => ({
          assets,
          destinationFolderId,
        }),
        mutationFn: ({
          assets,
          destinationFolderId,
          organizationId,
        }: {
          assets: Asset[]
          destinationFolderId: null | string
          organizationId: string
        }) => postAssetsMove(
          {
            data: {
              assetIds: assets.map(asset => asset.id),
              folderId: destinationFolderId,
            },
          },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: response => response.data,
        getUpdates: ({ assets, destinationFolderId }) =>
          assets.map(asset => ({
            asset,
            id: asset.id,
            patch: { folderId: destinationFolderId },
          })),
      }),
    ),
    favorite: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        mutationFn: ({ favorite, id, organizationId }: {
          favorite: boolean
          id: string
          organizationId: string
        }) =>
          favorite
            ? putAssetsIdFavorite(
                { id },
                { headers: getOrganizationRequestHeaders(organizationId) },
              )
            : deleteAssetsIdFavorite(
                { id },
                { headers: getOrganizationRequestHeaders(organizationId) },
              ),
        getUpdates: ({ favorite, id }) => [{ id, patch: { favorite } }],
      }),
    ),
    addTag: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        mutationFn: ({ assetId, organizationId, tag }: {
          assetId: string
          organizationId: string
          tag: Tag
        }) => putAssetsIdTagsTagid(
          {
            id: assetId,
            tagId: tag.id,
          },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getUpdates: ({ assetId, tag }) => [
          {
            id: assetId,
            patch: asset => ({
              tags: asset.tags.some(item => item.id === tag.id)
                ? asset.tags
                : [...asset.tags, tag],
            }),
          },
        ],
      }),
    ),
    removeTag: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        mutationFn: ({ assetId, organizationId, tag }: {
          assetId: string
          organizationId: string
          tag: Tag
        }) => deleteAssetsIdTagsTagid(
          {
            id: assetId,
            tagId: tag.id,
          },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getUpdates: ({ assetId, tag }) => [
          {
            id: assetId,
            patch: asset => ({
              tags: asset.tags.filter(item => item.id !== tag.id),
            }),
          },
        ],
      }),
    ),
  }
}

export function useTagMutations() {
  const queryClient = useQueryClient()

  return {
    create: useMutation({
      mutationFn: ({ name, organizationId }: {
        name: string
        organizationId: string
      }) => postTags(
        { data: { name } },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onSuccess: (tag, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        queryClient.setQueryData<TagListResponse>(
          assetQueryKeys.tags(organizationId),
          current =>
            current
              ? {
                  data: current.data.some(item => item.id === tag.id)
                    ? current.data.map(item =>
                        item.id === tag.id ? tag : item,
                      )
                    : [...current.data, tag],
                }
              : { data: [tag] },
        )
      },
      onSettled: (_data, error, { organizationId }) => {
        void queryClient.invalidateQueries({
          queryKey: assetQueryKeys.tags(organizationId),
          refetchType: error ? 'active' : 'none',
        })
      },
    }),
  }
}

export function useFolderMutations() {
  const queryClient = useQueryClient()

  return {
    create: useMutation({
      mutationFn: ({
        signal,
        ...data
      }: {
        name: string
        organizationId: string
        parentId?: null | string
        signal?: AbortSignal
      }) => postFolders(
        { data: { name: data.name, parentId: data.parentId } },
        {
          headers: getOrganizationRequestHeaders(data.organizationId),
          signal,
        },
      ),
      onMutate: async ({ organizationId, parentId }) => {
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(organizationId),
        })
        const snapshot = snapshotFolderCache(queryClient, organizationId)
        if (parentId)
          adjustFolderItemCountCache(queryClient, organizationId, parentId, 1)
        return { organizationId, snapshot }
      },
      onError: (_error, _variables, context) => {
        if (context && hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          restoreFolderCache(
            queryClient,
            context.organizationId,
            context.snapshot,
          )
        }
      },
      onSuccess: (folder, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        upsertFolderCache(queryClient, organizationId, folder)
      },
      onSettled: (_data, error, { organizationId }) => {
        void invalidateFolderCache(
          queryClient,
          organizationId,
          error ? 'active' : 'none',
        )
      },
    }),
    remove: useMutation({
      mutationFn: ({ id, organizationId }: {
        id: string
        organizationId: string
      }) => deleteFoldersId(
        { id },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async ({ id, organizationId }) => {
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(organizationId),
        })
        const folders = snapshotFolderCache(queryClient, organizationId)
        const assets = await snapshotAssetCache(queryClient, organizationId)
        const removedFolder = folders?.data.find(folder => folder.id === id)
        const removedIds = removeFolderTreeCache(queryClient, organizationId, id)
        if (removedFolder?.parentId) {
          adjustFolderItemCountCache(
            queryClient,
            organizationId,
            removedFolder.parentId,
            -1,
          )
        }
        patchMatchingAssets(
          queryClient,
          organizationId,
          asset => asset.folderId !== null && removedIds.has(asset.folderId),
          { folderId: null },
        )
        return { assets, folders, organizationId }
      },
      onError: (_error, _variables, context) => {
        if (context && hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          restoreFolderCache(
            queryClient,
            context.organizationId,
            context.folders,
          )
          restoreAssetCache(queryClient, context.assets)
        }
      },
      onSettled: (_data, _error, { organizationId }) => {
        void Promise.all([
          invalidateFolderCache(queryClient, organizationId),
          invalidateAssetCache(queryClient, organizationId),
        ])
      },
    }),
    update: useMutation({
      mutationFn: ({
        id,
        name,
        organizationId,
        parentId,
      }: {
        id: string
        name?: string
        organizationId: string
        parentId?: null | string
      }) => patchFoldersId(
        { id, data: { name, parentId } },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async ({ id, name, organizationId, parentId }) => {
        const patch = {
          ...(name !== undefined ? { name } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
        }
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(organizationId),
        })
        const snapshot = snapshotFolderCache(queryClient, organizationId)
        const currentFolder = snapshot?.data.find(folder => folder.id === id)
        if (
          patch.parentId !== undefined
          && patch.parentId !== currentFolder?.parentId
        ) {
          if (currentFolder?.parentId) {
            adjustFolderItemCountCache(
              queryClient,
              organizationId,
              currentFolder.parentId,
              -1,
            )
          }
          if (patch.parentId) {
            adjustFolderItemCountCache(
              queryClient,
              organizationId,
              patch.parentId,
              1,
            )
          }
        }
        patchFolderCache(queryClient, organizationId, id, patch)
        return { organizationId, snapshot }
      },
      onError: (_error, _variables, context) => {
        if (context && hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          restoreFolderCache(
            queryClient,
            context.organizationId,
            context.snapshot,
          )
        }
      },
      onSuccess: (folder, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        upsertFolderCache(queryClient, organizationId, folder)
      },
      onSettled: (_data, _error, { organizationId }) => {
        void invalidateFolderCache(queryClient, organizationId)
      },
    }),
  }
}
