/** Mutation dialogs owned by the Asset library controller. */

import type { Folder } from '@talelabs/sdk'
import type { useAssetMutations } from '../data/asset-mutations'
import type { useFolderMutations } from '../data/folder-mutations'
import type { LibraryDragData } from '../drag-and-drop/asset-drag-data'
import type { useAssetLibraryActions } from './use-asset-library-actions'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddToElementDialog } from '../../elements/add-to-element-dialog'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import {
  cancelFolderUploads,
} from '../../uploads/cancellation/upload-target-cancellation'
import { getFolderTreeIds } from '../data/folder-cache-tree'
import { FolderDeleteDialog } from '../folders/folder-delete-dialog'
import { MoveToFolderDialog } from '../folders/move-to-folder-dialog'
import { AssetNameDialog } from '../viewer/asset-name-dialog'
import { AssetPurgeDialog } from '../viewer/asset-purge-dialog'

/** Keeps rename, move, archive, purge, and folder deletion state out of rows. */
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
  const organizationId = useActiveOrganizationId()
  const [cancelingFolderUploads, setCancelingFolderUploads] = useState(false)
  const {
    addToElementAssetIds,
    deleteFolder,
    moveTarget,
    nameDialog,
    purgeAsset,
    runAction,
    setAddToElementAssetIds,
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
            () => assetMutations.purge.mutateAsync({
              id: purgeAsset.id,
              organizationId: organizationId!,
            }),
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
          setCancelingFolderUploads(true)
          try {
            if (organizationId) {
              await cancelFolderUploads(
                organizationId,
                getFolderTreeIds(folders, deleteFolder.id),
              )
            }
            const deleted = await runAction(
              () => folderMutations.remove.mutateAsync({
                id: deleteFolder.id,
                organizationId: organizationId!,
              }),
              'assets.folderDeleted',
            )
            if (deleted)
              setDeleteFolder(null)
          }
          finally {
            setCancelingFolderUploads(false)
          }
        }}
        onOpenChange={open => !open && setDeleteFolder(null)}
        open={Boolean(deleteFolder)}
        pending={cancelingFolderUploads || folderMutations.remove.isPending}
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
                  organizationId: organizationId!,
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
                  organizationId: organizationId!,
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
                organizationId: organizationId!,
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
      <AddToElementDialog
        assetIds={addToElementAssetIds ?? []}
        open={addToElementAssetIds !== null}
        onOpenChange={open => !open && setAddToElementAssetIds(null)}
      />
    </>
  )
}
