/** Project/folder destination picker and admission feedback for library moves. */

import type { Asset, Folder } from '@talelabs/sdk'

import { useTranslation } from 'react-i18next'
import { ProjectLocationDialog } from '../../projects/project-location-dialog'
import { validateLibraryMove } from '../drag-and-drop/folder-move-validation'

/** Asset selection or folder payload awaiting a destination in the move dialog. */
export type MoveDialogTarget
  = | { assets: Asset[], type: 'assets' }
    | { folder: Folder, type: 'folder' }

/** Prevents invalid cycles, no-op moves, and depth violations before mutation. */
export function MoveToFolderDialog({
  fixedProjectId,
  onMove,
  onOpenChange,
  open,
  pending,
  target,
}: {
  /** Project route scope that prevents cross-Project relocation. */
  fixedProjectId?: string
  onMove: (
    folderId: null | string,
    projectId: null | string,
    destinationLabel: string,
  ) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
  target: MoveDialogTarget | null
}) {
  const { t } = useTranslation()
  const source = target?.type === 'assets'
    ? {
        assetIds: target.assets.map(asset => asset.id),
        sourceFolderId: target.assets[0]?.folderId ?? null,
        type: 'asset' as const,
      }
    : target?.type === 'folder'
      ? {
          folderId: target.folder.id,
          parentId: target.folder.parentId,
          type: 'folder' as const,
        }
      : null
  const currentProjectId = fixedProjectId
    ?? (target?.type === 'folder'
      ? target.folder.projectId
      : target?.assets[0]?.projectId ?? null)
  const currentFolderId = target?.type === 'folder'
    ? target.folder.parentId
    : target?.assets[0]?.folderId ?? null

  return (
    <ProjectLocationDialog
      currentFolderId={currentFolderId}
      currentProjectId={currentProjectId}
      description={target?.type === 'folder'
        ? t('assets.moveFolderDescription', { name: target.folder.name })
        : t('assets.moveFilesDescription', {
            count: target?.assets.length ?? 0,
          })}
      open={open}
      pending={pending}
      projectLocked={Boolean(fixedProjectId)}
      title={t('assets.moveToFolder')}
      validateDestination={(projectId, folderId, folders) => {
        if (!source)
          return false
        if (projectId !== currentProjectId)
          return true
        return validateLibraryMove(source, folderId, folders).allowed
      }}
      onConfirm={(projectId, folderId, destinationLabel) =>
        onMove(folderId, projectId, destinationLabel)}
      onOpenChange={onOpenChange}
    />
  )
}
