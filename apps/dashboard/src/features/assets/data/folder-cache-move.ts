/** Folder aggregate-cache updates caused by moving Assets between folders. */

import type { Asset, FolderListResponse } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

function addDelta(
  deltas: Map<string, number>,
  folderId: string,
  delta: number,
) {
  deltas.set(folderId, (deltas.get(folderId) ?? 0) + delta)
}

function addSizeDeltaToLineage(
  foldersById: Map<string, FolderListResponse['data'][number]>,
  sizeDeltas: Map<string, number>,
  folderId: string,
  delta: number,
) {
  const visited = new Set<string>()
  let currentId: null | string = folderId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    addDelta(sizeDeltas, currentId, delta)
    currentId = foldersById.get(currentId)?.parentId ?? null
  }
}

/**
 * Applies Asset-move count, size-lineage, and thumbnail deltas to cached folder
 * metadata before the server response arrives.
 */
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
          foldersById,
          sizeDeltas,
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
          foldersById,
          sizeDeltas,
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
