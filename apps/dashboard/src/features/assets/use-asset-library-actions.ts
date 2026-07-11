import type { Asset, Folder, Tag } from '@talelabs/sdk'
import type { AssetActions, FolderActions } from './asset-actions.types'
import type {
  useAssetMutations,
  useTagMutations,
} from './asset.queries'
import type { MoveDialogTarget } from './move-to-folder-dialog'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'

export type AssetNameDialogState
  = | { kind: 'create-folder' }
    | { asset: Asset, kind: 'rename-asset' }
    | { folder: Folder, kind: 'rename-folder' }
    | null

export function useAssetLibraryActions({
  assetMutations,
  getSelectedAssets,
  navigateToFolder,
  onOpenAsset,
  organizationId,
  tagMutations,
  tags,
}: {
  assetMutations: ReturnType<typeof useAssetMutations>
  getSelectedAssets: (asset: Asset) => Asset[]
  navigateToFolder: (folderId: null | string) => void
  onOpenAsset: (asset: Asset) => void
  organizationId: null | string
  tagMutations: ReturnType<typeof useTagMutations>
  tags: Tag[]
}) {
  const { t } = useTranslation()
  const [purgeAsset, setPurgeAsset] = useState<Asset | null>(null)
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveDialogTarget | null>(null)
  const [nameDialog, setNameDialog] = useState<AssetNameDialogState>(null)

  async function runAction(action: () => Promise<unknown>, successKey: string) {
    try {
      await action()
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

  const assetActions: AssetActions = {
    favoritePending: assetMutations.favorite.isPending,
    onArchive: asset =>
      void runAction(
        () => assetMutations.archive.mutateAsync({
          id: asset.id,
          organizationId: requireOrganizationId(),
        }),
        'assets.archivedSuccess',
      ),
    onDetails: onOpenAsset,
    onDownload: asset =>
      void runAction(
        () => assetMutations.download.mutateAsync({
          id: asset.id,
          organizationId: requireOrganizationId(),
        }),
        'assets.downloadStarted',
      ),
    onMove: asset => setMoveTarget({
      assets: getSelectedAssets(asset),
      type: 'assets',
    }),
    onPurge: setPurgeAsset,
    onRename: asset => setNameDialog({ asset, kind: 'rename-asset' }),
    onRestore: asset =>
      void runAction(
        () => assetMutations.restore.mutateAsync({
          id: asset.id,
          organizationId: requireOrganizationId(),
        }),
        'assets.restoredSuccess',
      ),
    onToggleFavorite: asset =>
      void runAction(
        () =>
          assetMutations.favorite.mutateAsync({
            favorite: !asset.favorite,
            id: asset.id,
            organizationId: requireOrganizationId(),
          }),
        asset.favorite ? 'assets.favoriteRemoved' : 'assets.favoriteAdded',
      ),
    onToggleTag: async (asset, tag) => {
      const assigned = asset.tags.some(item => item.id === tag.id)
      await runAction(
        () =>
          assigned
            ? assetMutations.removeTag.mutateAsync({
                assetId: asset.id,
                organizationId: requireOrganizationId(),
                tag,
              })
            : assetMutations.addTag.mutateAsync({
                assetId: asset.id,
                organizationId: requireOrganizationId(),
                tag,
              }),
        assigned ? 'assets.tagRemoved' : 'assets.tagAdded',
      )
    },
    onCreateTag: async (asset, name) => {
      try {
        const scope = requireOrganizationId()
        const tag = await tagMutations.create.mutateAsync({
          name,
          organizationId: scope,
        })
        await assetMutations.addTag.mutateAsync({
          assetId: asset.id,
          organizationId: scope,
          tag,
        })
        toast.success(t('assets.tagAdded'))
      }
      catch (error) {
        toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
      }
    },
    tagPending:
      tagMutations.create.isPending
      || assetMutations.addTag.isPending
      || assetMutations.removeTag.isPending,
    tags,
  }
  const folderActions: FolderActions = {
    onDelete: setDeleteFolder,
    onMove: folder => setMoveTarget({ folder, type: 'folder' }),
    onOpen: folder => navigateToFolder(folder.id),
    onRename: folder => setNameDialog({ folder, kind: 'rename-folder' }),
  }

  return {
    assetActions,
    deleteFolder,
    folderActions,
    moveTarget,
    nameDialog,
    purgeAsset,
    runAction,
    setDeleteFolder,
    setMoveTarget,
    setNameDialog,
    setPurgeAsset,
  }
}
