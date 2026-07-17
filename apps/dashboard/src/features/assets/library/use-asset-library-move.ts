/** Move admission and mutation dispatch for Assets and complete folder subtrees. */

import type { Asset, Folder } from '@talelabs/sdk'
import type { RefObject } from 'react'
import type { LibraryDragData } from '../drag-and-drop/asset-drag-data'
import type { MoveRejection } from '../drag-and-drop/folder-move-validation'

import {
  announce,
  cleanup as cleanupLiveRegion,
} from '@atlaskit/pragmatic-drag-and-drop-live-region'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { validateLibraryMove } from '../drag-and-drop/folder-move-validation'
import { isAssetDragData } from '../drag-and-drop/library-drag-data-guards'
import { useAssetDragMonitor } from '../drag-and-drop/use-asset-drag-monitor'

/** Validates drag/dialog moves and dispatches the matching Asset or folder mutation. */
export function useAssetLibraryMove({
  assets,
  clearSelection,
  folders,
  libraryRef,
  moveAssets,
  moveFolder,
}: {
  assets: Asset[]
  clearSelection: () => void
  folders: Folder[]
  libraryRef: RefObject<HTMLElement | null>
  moveAssets: (assets: Asset[], destinationFolderId: null | string) => Promise<unknown>
  moveFolder: (folder: Folder, destinationFolderId: null | string) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const assetMap = useMemo(
    () => new Map(assets.map(asset => [asset.id, asset])),
    [assets],
  )
  const folderMap = useMemo(
    () => new Map(folders.map(folder => [folder.id, folder])),
    [folders],
  )

  useEffect(() => () => cleanupLiveRegion(), [])

  function getRejectionMessage(reason: MoveRejection) {
    const keys = {
      'depth': 'assets.moveRejectedDepth',
      'descendant': 'assets.moveRejectedDescendant',
      'same-folder': 'assets.moveRejectedSameFolder',
      'self': 'assets.moveRejectedSelf',
    } as const

    return t(keys[reason])
  }

  async function moveLibraryItems(
    source: LibraryDragData,
    destinationFolderId: null | string,
  ) {
    const validation = validateLibraryMove(
      source,
      destinationFolderId,
      folders,
    )

    if (!validation.allowed) {
      const message = getRejectionMessage(validation.reason)
      toast.error(message)
      announce(message)
      return false
    }

    const destination
      = destinationFolderId === null
        ? t('assets.rootFolder')
        : (folderMap.get(destinationFolderId)?.name ?? t('assets.rootFolder'))

    try {
      let message: string

      if (isAssetDragData(source)) {
        const movingAssets = source.assetIds
          .map(id => assetMap.get(id))
          .filter((asset): asset is Asset => Boolean(asset))

        if (movingAssets.length !== source.assetIds.length)
          throw new Error('Asset selection is stale')

        const move = moveAssets(movingAssets, destinationFolderId)
        clearSelection()
        await move
        message = t('assets.filesMoved', {
          count: movingAssets.length,
          destination,
        })
      }
      else {
        const folder = folderMap.get(source.folderId)
        if (!folder)
          throw new Error('Folder selection is stale')

        const move = moveFolder(folder, destinationFolderId)
        clearSelection()
        await move
        message = t('assets.folderMoved', { destination, name: folder.name })
      }

      toast.success(message)
      announce(message)
      requestAnimationFrame(() => libraryRef.current?.focus())
      return true
    }
    catch (error) {
      const message = getApiErrorMessage(error, 'assets.actionFailed')
      toast.error(message)
      announce(message)
      return false
    }
  }

  const activeDragData = useAssetDragMonitor({
    onDrop: (source, destinationFolderId) => {
      void moveLibraryItems(source, destinationFolderId)
    },
  })

  return {
    activeDragData,
    getFolderDragData: (folder: Folder) => ({
      folderId: folder.id,
      parentId: folder.parentId,
      type: 'folder' as const,
    }),
    moveLibraryItems,
  }
}
