/** Viewer command controller for metadata and destructive Asset mutations. */

import type { Asset } from '@talelabs/sdk'
import type { AssetActions } from '../library/asset-actions.types'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { useAssetMutations } from '../data/asset-mutations'
import { useFoldersQuery } from '../data/folder-query'
import { useTagMutations } from '../data/tag-mutations'
import { useTagsQuery } from '../data/tag-query'

/** Composes viewer rename, favorite, archive, purge, folder, and tag actions. */
export function useAssetViewerActions({
  asset,
  onPurged,
}: {
  asset?: Asset
  onPurged: () => void
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
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

  function requireOrganizationId() {
    if (!organizationId)
      throw new Error('An active organization is required.')
    return organizationId
  }

  const actions: AssetActions = {
    favoritePending: assetMutations.favorite.isPending,
    onArchive: item =>
      void runAction(
        () => assetMutations.archive.mutateAsync({
          id: item.id,
          organizationId: requireOrganizationId(),
        }),
        'assets.archivedSuccess',
      ),
    onCreateTag: async (item, name) => {
      try {
        const scope = requireOrganizationId()
        const tag = await tagMutations.create.mutateAsync({
          name,
          organizationId: scope,
        })
        await assetMutations.addTag.mutateAsync({
          assetId: item.id,
          organizationId: scope,
          tag,
        })
        toast.success(t('assets.tagAdded'))
      }
      catch (error) {
        toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
      }
    },
    onDetails: () => {},
    onDownload: item =>
      void runAction(
        () => assetMutations.download.mutateAsync({
          id: item.id,
          organizationId: requireOrganizationId(),
        }),
        'assets.downloadStarted',
      ),
    onMove: setMoveAsset,
    onPurge: setPurgeAsset,
    onRename: setRenameAsset,
    onRestore: item =>
      void runAction(
        () => assetMutations.restore.mutateAsync({
          id: item.id,
          organizationId: requireOrganizationId(),
        }),
        'assets.restoredSuccess',
      ),
    onToggleFavorite: item =>
      void runAction(
        () =>
          assetMutations.favorite.mutateAsync({
            favorite: !item.favorite,
            id: item.id,
            organizationId: requireOrganizationId(),
          }),
        item.favorite ? 'assets.favoriteRemoved' : 'assets.favoriteAdded',
      ),
    onToggleTag: async (item, tag) => {
      const assigned = item.tags.some(current => current.id === tag.id)
      await runAction(
        () =>
          assigned
            ? assetMutations.removeTag.mutateAsync({
                assetId: item.id,
                organizationId: requireOrganizationId(),
                tag,
              })
            : assetMutations.addTag.mutateAsync({
                assetId: item.id,
                organizationId: requireOrganizationId(),
                tag,
              }),
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
          organizationId: requireOrganizationId(),
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
        () => assetMutations.purge.mutateAsync({
          id: purgeAsset.id,
          organizationId: requireOrganizationId(),
        }),
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
        () => assetMutations.update.mutateAsync({
          id: renameAsset.id,
          name,
          organizationId: requireOrganizationId(),
        }),
        'assets.renamedSuccess',
      )
      if (renamed)
        setRenameAsset(null)
    },
  }
}
