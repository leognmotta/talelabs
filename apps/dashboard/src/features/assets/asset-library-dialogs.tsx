import type { Folder } from '@talelabs/sdk'
import type {
  useAssetMutations,
  useFolderMutations,
} from './asset.queries'
import type { LibraryDragData } from './drag-and-drop/asset-drag-data'
import type { useAssetLibraryActions } from './use-asset-library-actions'

import { useTranslation } from 'react-i18next'
import { AssetNameDialog } from './asset-name-dialog'
import { AssetPurgeDialog } from './asset-purge-dialog'
import { FolderDeleteDialog } from './folder-delete-dialog'
import { MoveToFolderDialog } from './move-to-folder-dialog'

export function AssetLibraryDialogs({
  actions,
  assetMutations,
  folderId,
  folderMutations,
  folders,
  moveLibraryItems,
}: {
  actions: ReturnType<typeof useAssetLibraryActions>
  assetMutations: ReturnType<typeof useAssetMutations>
  folderId: null | string
  folderMutations: ReturnType<typeof useFolderMutations>
  folders: Folder[]
  moveLibraryItems: (
    source: LibraryDragData,
    destinationFolderId: null | string,
  ) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const {
    deleteFolder,
    moveTarget,
    nameDialog,
    purgeAsset,
    runAction,
    setDeleteFolder,
    setMoveTarget,
    setNameDialog,
    setPurgeAsset,
  } = actions

  return (
    <>
      <MoveToFolderDialog
        folders={folders}
        key={
          moveTarget?.type === 'folder'
            ? moveTarget.folder.id
            : (moveTarget?.assets.map(asset => asset.id).join(':')
              ?? 'move-items')
        }
        onMove={async (destination) => {
          if (!moveTarget)
            return

          const target = moveTarget
          const source: LibraryDragData
            = target.type === 'assets'
              ? {
                  assetIds: target.assets.map(asset => asset.id),
                  sourceFolderId: target.assets[0]?.folderId ?? null,
                  type: 'asset',
                }
              : {
                  folderId: target.folder.id,
                  parentId: target.folder.parentId,
                  type: 'folder',
                }
          setMoveTarget(null)
          await moveLibraryItems(source, destination)
        }}
        onOpenChange={open => !open && setMoveTarget(null)}
        open={Boolean(moveTarget)}
        pending={
          assetMutations.move.isPending || folderMutations.update.isPending
        }
        target={moveTarget}
      />
      <AssetPurgeDialog
        asset={purgeAsset}
        onConfirm={async () => {
          if (!purgeAsset)
            return
          const purged = await runAction(
            () => assetMutations.purge.mutateAsync(purgeAsset.id),
            'assets.deletionStarted',
          )
          if (purged)
            setPurgeAsset(null)
        }}
        onOpenChange={open => !open && setPurgeAsset(null)}
        open={Boolean(purgeAsset)}
        pending={assetMutations.purge.isPending}
      />
      <FolderDeleteDialog
        folder={deleteFolder}
        onConfirm={async () => {
          if (!deleteFolder)
            return
          const deleted = await runAction(
            () => folderMutations.remove.mutateAsync(deleteFolder.id),
            'assets.folderDeleted',
          )
          if (deleted)
            setDeleteFolder(null)
        }}
        onOpenChange={open => !open && setDeleteFolder(null)}
        open={Boolean(deleteFolder)}
        pending={folderMutations.remove.isPending}
      />
      <AssetNameDialog
        description={
          nameDialog?.kind === 'create-folder'
            ? t('assets.createFolderDescription')
            : t('assets.renameDescription')
        }
        initialName={
          nameDialog?.kind === 'rename-asset'
            ? nameDialog.asset.name
            : nameDialog?.kind === 'rename-folder'
              ? nameDialog.folder.name
              : ''
        }
        key={
          nameDialog?.kind === 'rename-asset'
            ? nameDialog.asset.id
            : nameDialog?.kind === 'rename-folder'
              ? nameDialog.folder.id
              : 'create-folder'
        }
        onOpenChange={open => !open && setNameDialog(null)}
        onSubmit={async (name) => {
          if (!nameDialog)
            return
          if (nameDialog.kind === 'create-folder') {
            if (
              !(await runAction(
                () => folderMutations.create.mutateAsync({
                  name,
                  parentId: folderId,
                }),
                'assets.folderCreated',
              ))
            ) {
              return
            }
          }
          else if (nameDialog.kind === 'rename-folder') {
            if (
              !(await runAction(
                () => folderMutations.update.mutateAsync({
                  id: nameDialog.folder.id,
                  name,
                }),
                'assets.renamedSuccess',
              ))
            ) {
              return
            }
          }
          else if (
            !(await runAction(
              () => assetMutations.update.mutateAsync({
                id: nameDialog.asset.id,
                name,
              }),
              'assets.renamedSuccess',
            ))
          ) {
            return
          }
          setNameDialog(null)
        }}
        open={Boolean(nameDialog)}
        pending={
          assetMutations.update.isPending
          || folderMutations.create.isPending
          || folderMutations.update.isPending
        }
        submitLabel={
          nameDialog?.kind === 'create-folder'
            ? t('common.create')
            : t('common.save')
        }
        title={
          nameDialog?.kind === 'create-folder'
            ? t('assets.newFolder')
            : t('assets.rename')
        }
      />
    </>
  )
}
