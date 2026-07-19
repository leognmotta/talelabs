/** Asset library entry point into the dashboard-wide background upload queue. */

import type { Folder } from '@talelabs/sdk'
import type { AssetUploadSelection } from '../upload/asset-upload-selection-contract'

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { enqueueAssetUploadBatch } from '../../uploads/queue/upload-queue-enqueue'
import { getFolderPath } from '../media/asset-formatters'
import { isAcceptedAssetFile } from '../upload/asset-upload-files'
import { getAssetUploadSelections } from '../upload/asset-upload-selection'
import { useAssetFileDrop } from '../upload/use-asset-file-drop'
import { useAssetUploadPolicyDescription } from '../upload/use-asset-upload-policy-description'

/** Enqueues picker/drop selections into the background queue for this folder. */
export function useAssetLibraryUpload({
  folderId,
  folders,
  onBatchEnqueued,
}: {
  folderId: null | string
  folders: Folder[]
  /** Reports each enqueued batch so callers can track their own uploads. */
  onBatchEnqueued?: (batchId: string) => void
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const policyDescription = useAssetUploadPolicyDescription()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  function uploadSelections(selections: AssetUploadSelection[]) {
    const acceptedSelections = selections.filter(selection =>
      isAcceptedAssetFile(selection.file),
    )

    if (acceptedSelections.length === 0) {
      toast.error(t('assets.noSupportedFiles'), {
        description: policyDescription,
      })
      return
    }

    if (!organizationId) {
      toast.error(t('errors.active_organization_required'))
      return
    }

    const path = getFolderPath(folders, folderId)
    const batchId = enqueueAssetUploadBatch({
      destinationLabel: path.at(-1)?.name ?? t('assets.rootFolder'),
      files: acceptedSelections,
      folders,
      organizationId,
      parentFolderId: folderId,
    })
    if (!batchId) {
      toast.error(t('errors.organization_context_changed'))
      return
    }
    onBatchEnqueued?.(batchId)
  }

  function uploadFiles(files: FileList | File[]) {
    uploadSelections(getAssetUploadSelections(files))
  }

  const fileDrop = useAssetFileDrop({ onFiles: uploadSelections })

  return {
    fileDrop,
    fileInputRef,
    folderInputRef,
    openFilePicker: () => fileInputRef.current?.click(),
    openFolderPicker: () => folderInputRef.current?.click(),
    uploadFiles,
  }
}
