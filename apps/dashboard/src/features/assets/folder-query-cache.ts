import type { Asset, Folder, FolderListResponse } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

export function snapshotFolderCache(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.getQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
  )
}

export function restoreFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  snapshot?: FolderListResponse,
) {
  queryClient.setQueryData(assetQueryKeys.folders(organizationId), snapshot)
}

export function upsertFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  folder: Folder,
) {
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    (current) => {
      if (!current)
        return { data: [folder] }

      const exists = current.data.some(item => item.id === folder.id)
      return {
        data: exists
          ? current.data.map(item => (item.id === folder.id ? folder : item))
          : [...current.data, folder],
      }
    },
  )
}

export function patchFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  folderId: string,
  patch: Partial<Folder>,
) {
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    current =>
      current
        ? {
            data: current.data.map(folder =>
              folder.id === folderId ? { ...folder, ...patch } : folder,
            ),
          }
        : current,
  )
}

export function adjustFolderItemCountCache(
  queryClient: QueryClient,
  organizationId: string,
  folderId: string,
  delta: number,
) {
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    current =>
      current
        ? {
            data: current.data.map(folder =>
              folder.id === folderId
                ? {
                    ...folder,
                    itemCount: Math.max(0, folder.itemCount + delta),
                  }
                : folder,
            ),
          }
        : current,
  )
}

export function applyAssetMoveToFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  assets: Array<Pick<Asset, 'folderId' | 'sizeBytes' | 'thumbnailUrl'>>,
  destinationFolderId: null | string,
) {
  const movingAssets = assets.filter(
    asset => asset.folderId !== destinationFolderId,
  )
  if (movingAssets.length === 0)
    return

  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    (current) => {
      if (!current)
        return current

      const foldersById = new Map(
        current.data.map(folder => [folder.id, folder]),
      )
      const itemCountDeltas = new Map<string, number>()
      const sizeDeltas = new Map<string, number>()
      const removedThumbnails = new Map<string, Set<string>>()

      function addDelta(
        deltas: Map<string, number>,
        folderId: string,
        delta: number,
      ) {
        deltas.set(folderId, (deltas.get(folderId) ?? 0) + delta)
      }

      function addSizeDeltaToLineage(folderId: string, delta: number) {
        const visited = new Set<string>()
        let currentId: null | string = folderId

        while (currentId && !visited.has(currentId)) {
          visited.add(currentId)
          addDelta(sizeDeltas, currentId, delta)
          currentId = foldersById.get(currentId)?.parentId ?? null
        }
      }

      const assetsBySource = new Map<string, typeof movingAssets>()
      for (const asset of movingAssets) {
        if (!asset.folderId)
          continue

        const sourceAssets = assetsBySource.get(asset.folderId) ?? []
        sourceAssets.push(asset)
        assetsBySource.set(asset.folderId, sourceAssets)
      }

      for (const [sourceFolderId, sourceAssets] of assetsBySource) {
        addDelta(itemCountDeltas, sourceFolderId, -sourceAssets.length)
        addSizeDeltaToLineage(
          sourceFolderId,
          -sourceAssets.reduce(
            (total, asset) => total + (asset.sizeBytes ?? 0),
            0,
          ),
        )
        removedThumbnails.set(
          sourceFolderId,
          new Set(
            sourceAssets.flatMap(asset =>
              asset.thumbnailUrl ? [asset.thumbnailUrl] : [],
            ),
          ),
        )
      }

      if (destinationFolderId) {
        addDelta(itemCountDeltas, destinationFolderId, movingAssets.length)
        addSizeDeltaToLineage(
          destinationFolderId,
          movingAssets.reduce(
            (total, asset) => total + (asset.sizeBytes ?? 0),
            0,
          ),
        )
      }

      const destinationThumbnails = movingAssets.flatMap(asset =>
        asset.thumbnailUrl ? [asset.thumbnailUrl] : [],
      )

      return {
        data: current.data.map((folder) => {
          const itemCountDelta = itemCountDeltas.get(folder.id) ?? 0
          const sizeDelta = sizeDeltas.get(folder.id) ?? 0
          const thumbnailsToRemove = removedThumbnails.get(folder.id)
          const retainedThumbnails = thumbnailsToRemove
            ? folder.thumbnailUrls.filter(url => !thumbnailsToRemove.has(url))
            : folder.thumbnailUrls
          const thumbnailUrls
            = folder.id === destinationFolderId
              ? [
                  ...new Set([...destinationThumbnails, ...retainedThumbnails]),
                ].slice(0, 4)
              : retainedThumbnails

          return {
            ...folder,
            itemCount: Math.max(0, folder.itemCount + itemCountDelta),
            thumbnailUrls,
            totalSizeBytes: Math.max(0, folder.totalSizeBytes + sizeDelta),
          }
        }),
      }
    },
  )
}

export function getFolderTreeIds(folders: Folder[], rootId: string) {
  const childrenByParent = new Map<string, string[]>()
  for (const folder of folders) {
    if (!folder.parentId)
      continue
    const children = childrenByParent.get(folder.parentId) ?? []
    children.push(folder.id)
    childrenByParent.set(folder.parentId, children)
  }

  const ids = new Set([rootId])
  const pending = [rootId]
  while (pending.length > 0) {
    const parentId = pending.pop()!
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (!ids.has(childId)) {
        ids.add(childId)
        pending.push(childId)
      }
    }
  }

  return ids
}

export function removeFolderTreeCache(
  queryClient: QueryClient,
  organizationId: string,
  rootId: string,
) {
  const current = snapshotFolderCache(queryClient, organizationId)
  if (!current)
    return new Set([rootId])

  const ids = getFolderTreeIds(current.data, rootId)
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    {
      data: current.data.filter(folder => !ids.has(folder.id)),
    },
  )
  return ids
}

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
