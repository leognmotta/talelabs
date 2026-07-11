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
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import {
  invalidateAssetCache,
  patchMatchingAssets,
  restoreAssetCache,
  snapshotAssetCache,
} from './asset-query-cache'
import { assetQueryKeys } from './asset-query-keys'
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

const ASSET_MEDIA_REFRESH_INTERVAL_MS = 45 * 60 * 1_000
const ASSET_PROCESSING_REFRESH_INTERVAL_MS = 3_000
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

function assetNeedsProcessingRefresh(asset: Pick<Asset, 'lifecycle' | 'processingState'>) {
  return asset.processingState === 'processing' || asset.lifecycle === 'purging'
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
  type?: AssetType
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
        { signal },
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
    queryFn: ({ signal }) => getFolders({ signal }),
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
    queryFn: ({ signal }) => getTags({ signal }),
    enabled: enabled && Boolean(organizationId),
    staleTime: 60_000,
  })
}

export function useAssetDetailQuery(id: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: assetQueryKeys.detail(organizationId, id),
    queryFn: ({ signal }) => getAssetsId({ id: id! }, { signal }),
    enabled: Boolean(organizationId && id),
    refetchInterval: query => query.state.data
      && assetNeedsProcessingRefresh(query.state.data)
      ? ASSET_PROCESSING_REFRESH_INTERVAL_MS
      : ASSET_MEDIA_REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useAssetMutations() {
  const queryClient = useQueryClient()
  const organizationId = useActiveOrganizationId()

  return {
    archive: useMutation(
      optimisticAssetMutationOptions(queryClient, organizationId, {
        affectsFolderMetadata: true,
        mutationFn: (id: string) => deleteAssetsId({ id }),
        getUpdates: id => [{ id, patch: { lifecycle: 'archived' } }],
      }),
    ),
    download: useMutation({
      mutationFn: async (id: string) => {
        const result = await getAssetsIdDownload({ id })
        window.location.assign(result.url)
      },
    }),
    purge: useMutation(
      optimisticAssetMutationOptions(queryClient, organizationId, {
        affectsFolderMetadata: true,
        mutationFn: (id: string) => postAssetsIdPurge({ id }),
        getServerAssets: asset => [asset],
        getUpdates: id => [
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
      optimisticAssetMutationOptions(queryClient, organizationId, {
        affectsFolderMetadata: true,
        mutationFn: (id: string) => postAssetsIdRestore({ id }),
        getServerAssets: asset => [asset],
        getUpdates: id => [{ id, patch: { lifecycle: 'live' } }],
      }),
    ),
    update: useMutation(
      optimisticAssetMutationOptions(queryClient, organizationId, {
        affectsFolderMetadata: variables => variables.folderId !== undefined,
        mutationFn: ({
          id,
          ...data
        }: {
          folderId?: null | string
          id: string
          name?: string
        }) => patchAssetsId({ id, data }),
        getServerAssets: asset => [asset],
        getUpdates: ({ id, ...patch }) => [{ id, patch }],
      }),
    ),
    move: useMutation(
      optimisticAssetMutationOptions(queryClient, organizationId, {
        affectsFolderMetadata: true,
        getFolderMove: ({ assets, destinationFolderId }) => ({
          assets,
          destinationFolderId,
        }),
        mutationFn: ({
          assets,
          destinationFolderId,
        }: {
          assets: Asset[]
          destinationFolderId: null | string
        }) => postAssetsMove({
          data: {
            assetIds: assets.map(asset => asset.id),
            folderId: destinationFolderId,
          },
        }),
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
      optimisticAssetMutationOptions(queryClient, organizationId, {
        mutationFn: ({ favorite, id }: { favorite: boolean, id: string }) =>
          favorite
            ? putAssetsIdFavorite({ id })
            : deleteAssetsIdFavorite({ id }),
        getUpdates: ({ favorite, id }) => [{ id, patch: { favorite } }],
      }),
    ),
    addTag: useMutation(
      optimisticAssetMutationOptions(queryClient, organizationId, {
        mutationFn: ({ assetId, tag }: { assetId: string, tag: Tag }) =>
          putAssetsIdTagsTagid({
            id: assetId,
            tagId: tag.id,
          }),
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
      optimisticAssetMutationOptions(queryClient, organizationId, {
        mutationFn: ({ assetId, tag }: { assetId: string, tag: Tag }) =>
          deleteAssetsIdTagsTagid({
            id: assetId,
            tagId: tag.id,
          }),
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
  const organizationId = useActiveOrganizationId()

  return {
    create: useMutation({
      mutationFn: (name: string) => postTags({ data: { name } }),
      onSuccess: (tag) => {
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
      onSettled: (_data, error) => {
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
  const organizationId = useActiveOrganizationId()

  function requireOrganizationId() {
    if (!organizationId)
      throw new Error('An active organization is required.')

    return organizationId
  }

  return {
    create: useMutation({
      mutationFn: ({
        signal,
        ...data
      }: {
        name: string
        parentId?: null | string
        signal?: AbortSignal
      }) => postFolders({ data }, { signal }),
      onMutate: async ({ parentId }) => {
        const scope = requireOrganizationId()
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(scope),
        })
        const snapshot = snapshotFolderCache(queryClient, scope)
        if (parentId)
          adjustFolderItemCountCache(queryClient, scope, parentId, 1)
        return snapshot
      },
      onError: (_error, _variables, snapshot) => {
        if (organizationId)
          restoreFolderCache(queryClient, organizationId, snapshot)
      },
      onSuccess: (folder) => {
        if (organizationId)
          upsertFolderCache(queryClient, organizationId, folder)
      },
      onSettled: (_data, error) => {
        if (organizationId) {
          void invalidateFolderCache(
            queryClient,
            organizationId,
            error ? 'active' : 'none',
          )
        }
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteFoldersId({ id }),
      onMutate: async (id) => {
        const scope = requireOrganizationId()
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(scope),
        })
        const folders = snapshotFolderCache(queryClient, scope)
        const assets = await snapshotAssetCache(queryClient, scope)
        const removedFolder = folders?.data.find(folder => folder.id === id)
        const removedIds = removeFolderTreeCache(queryClient, scope, id)
        if (removedFolder?.parentId) {
          adjustFolderItemCountCache(
            queryClient,
            scope,
            removedFolder.parentId,
            -1,
          )
        }
        patchMatchingAssets(
          queryClient,
          scope,
          asset => asset.folderId !== null && removedIds.has(asset.folderId),
          { folderId: null },
        )
        return { assets, folders }
      },
      onError: (_error, _id, snapshot) => {
        if (organizationId)
          restoreFolderCache(queryClient, organizationId, snapshot?.folders)
        restoreAssetCache(queryClient, snapshot?.assets)
      },
      onSettled: () => {
        if (!organizationId)
          return
        void Promise.all([
          invalidateFolderCache(queryClient, organizationId),
          invalidateAssetCache(queryClient, organizationId),
        ])
      },
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...data
      }: {
        id: string
        name?: string
        parentId?: null | string
      }) => patchFoldersId({ id, data }),
      onMutate: async ({ id, ...patch }) => {
        const scope = requireOrganizationId()
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(scope),
        })
        const snapshot = snapshotFolderCache(queryClient, scope)
        const currentFolder = snapshot?.data.find(folder => folder.id === id)
        if (
          patch.parentId !== undefined
          && patch.parentId !== currentFolder?.parentId
        ) {
          if (currentFolder?.parentId) {
            adjustFolderItemCountCache(
              queryClient,
              scope,
              currentFolder.parentId,
              -1,
            )
          }
          if (patch.parentId)
            adjustFolderItemCountCache(queryClient, scope, patch.parentId, 1)
        }
        patchFolderCache(queryClient, scope, id, patch)
        return snapshot
      },
      onError: (_error, _variables, snapshot) => {
        if (organizationId)
          restoreFolderCache(queryClient, organizationId, snapshot)
      },
      onSuccess: (folder) => {
        if (organizationId)
          upsertFolderCache(queryClient, organizationId, folder)
      },
      onSettled: () => {
        if (organizationId)
          void invalidateFolderCache(queryClient, organizationId)
      },
    }),
  }
}
