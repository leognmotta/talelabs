import type { Asset } from '@talelabs/sdk'
import type { AssetActions } from './asset-actions.types'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import {
  useAssetMutations,
  useFoldersQuery,
  useTagMutations,
  useTagsQuery,
} from './asset.queries'

export function useAssetViewerActions({
  asset,
  onPurged,
}: {
  asset?: Asset
  onPurged: () => void
}) {
  const { t } = useTranslation()
  const assetMutations = useAssetMutations()
  const tagMutations = useTagMutations()
  const foldersQuery = useFoldersQuery(Boolean(asset))
  const tagsQuery = useTagsQuery(Boolean(asset))
  const [moveAsset, setMoveAsset] = useState<Asset | null>(null)
  const [purgeAsset, setPurgeAsset] = useState<Asset | null>(null)
  const [renameAsset, setRenameAsset] = useState<Asset | null>(null)
  const folders = useMemo(
    () => foldersQuery.data?.data ?? [],
    [foldersQuery.data?.data],
  )
  const tags = useMemo(
    () => tagsQuery.data?.data ?? [],
    [tagsQuery.data?.data],
  )

  async function runAction(
    action: () => Promise<unknown>,
    successKey?: string,
  ) {
    try {
      await action()
      if (successKey)
        toast.success(t(successKey as 'assets.updated'))
      return true
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
      return false
    }
  }

  const actions: AssetActions = {
    favoritePending: assetMutations.favorite.isPending,
    onArchive: item =>
      void runAction(
        () => assetMutations.archive.mutateAsync(item.id),
        'assets.archivedSuccess',
      ),
    onCreateTag: async (item, name) => {
      try {
        const tag = await tagMutations.create.mutateAsync(name)
        await assetMutations.addTag.mutateAsync({ assetId: item.id, tag })
        toast.success(t('assets.tagAdded'))
      }
      catch (error) {
        toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
      }
    },
    onDetails: () => {},
    onDownload: item =>
      void runAction(
        () => assetMutations.download.mutateAsync(item.id),
        'assets.downloadStarted',
      ),
    onMove: setMoveAsset,
    onPurge: setPurgeAsset,
    onRename: setRenameAsset,
    onRestore: item =>
      void runAction(
        () => assetMutations.restore.mutateAsync(item.id),
        'assets.restoredSuccess',
      ),
    onToggleFavorite: item =>
      void runAction(
        () =>
          assetMutations.favorite.mutateAsync({
            favorite: !item.favorite,
            id: item.id,
          }),
        item.favorite ? 'assets.favoriteRemoved' : 'assets.favoriteAdded',
      ),
    onToggleTag: async (item, tag) => {
      const assigned = item.tags.some(current => current.id === tag.id)
      await runAction(
        () =>
          assigned
            ? assetMutations.removeTag.mutateAsync({ assetId: item.id, tag })
            : assetMutations.addTag.mutateAsync({ assetId: item.id, tag }),
        assigned ? 'assets.tagRemoved' : 'assets.tagAdded',
      )
    },
    tagPending:
      tagMutations.create.isPending
      || assetMutations.addTag.isPending
      || assetMutations.removeTag.isPending,
    tags,
  }

  return {
    actions,
    dialogs: {
      moveAsset,
      purgeAsset,
      renameAsset,
      setMoveAsset,
      setPurgeAsset,
      setRenameAsset,
    },
    folders,
    mutations: assetMutations,
    onMove: async (destinationFolderId: null | string) => {
      if (!moveAsset)
        return

      const assetToMove = moveAsset
      const destination
        = destinationFolderId === null
          ? t('assets.rootFolder')
          : (folders.find(folder => folder.id === destinationFolderId)
              ?.name ?? t('assets.rootFolder'))
      setMoveAsset(null)
      const moved = await runAction(() =>
        assetMutations.move.mutateAsync({
          assets: [assetToMove],
          destinationFolderId,
        }),
      )
      if (moved) {
        toast.success(t('assets.filesMoved', { count: 1, destination }))
      }
    },
    onPurge: async () => {
      if (!purgeAsset)
        return
      const purged = await runAction(
        () => assetMutations.purge.mutateAsync(purgeAsset.id),
        'assets.deletionStarted',
      )
      if (purged) {
        setPurgeAsset(null)
        onPurged()
      }
    },
    onRename: async (name: string) => {
      if (!renameAsset)
        return
      const renamed = await runAction(
        () => assetMutations.update.mutateAsync({ id: renameAsset.id, name }),
        'assets.renamedSuccess',
      )
      if (renamed)
        setRenameAsset(null)
    },
  }
}
