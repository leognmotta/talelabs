import type { Asset, Folder } from '@talelabs/sdk'
import type { AssetUploadSelection } from './asset-upload-selection'
import type { AssetUploadControl } from './use-asset-uploader'

import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { invalidateAssetCache, upsertAssetCache } from './asset-query-cache'
import { isAssetUploadAbortError } from './asset-upload-batch'
import { isAcceptedAssetFile } from './asset-upload-files'
import { getAssetUploadSelections } from './asset-upload-selection'
import { invalidateFolderCache } from './folder-query-cache'
import { useAssetFileDrop } from './use-asset-file-drop'
import { useAssetFolderUpload } from './use-asset-folder-upload'
import { useAssetUploadPolicyDescription } from './use-asset-upload-policy-description'
import { useAssetUploader } from './use-asset-uploader'

export function useAssetLibraryUpload({
  createFolder,
  folderId,
  folders,
}: {
  createFolder: (
    input: { name: string, parentId: null | string },
    signal: AbortSignal,
  ) => Promise<Folder>
  folderId: null | string
  folders: Folder[]
}) {
  const { i18n, t } = useTranslation()
  const queryClient = useQueryClient()
  const organizationId = useActiveOrganizationId()
  const policyDescription = useAssetUploadPolicyDescription()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const toastIdsRef = useRef(
    new WeakMap<File, ReturnType<typeof toast.loading>>(),
  )
  const progressFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.resolvedLanguage ?? 'en', {
        maximumFractionDigits: 0,
        style: 'percent',
      }),
    [i18n.resolvedLanguage],
  )

  function getCancelAction(control: AssetUploadControl) {
    return { label: t('common.cancel'), onClick: control.cancel }
  }

  function completeUpload(asset: Asset, file: File) {
    if (!organizationId)
      return

    upsertAssetCache(queryClient, organizationId, asset)
    void invalidateAssetCache(queryClient, organizationId, 'none')
    void invalidateFolderCache(queryClient, organizationId)
    toast.success(asset.name, {
      description: t('assets.uploadComplete'),
      id: toastIdsRef.current.get(file),
    })
    toastIdsRef.current.delete(file)
  }

  const uploader = useAssetUploader({
    folderId,
    onCancel: (file) => {
      toast.info(file.name, {
        description: t('assets.uploadCanceled'),
        id: toastIdsRef.current.get(file),
      })
      toastIdsRef.current.delete(file)
    },
    onComplete: completeUpload,
    onError: ({ code, file }) => {
      const description
        = code === 'storage_request_blocked'
          ? t('assets.uploadBlockedDescription')
          : code === 'storage_upload_rejected'
            ? t('assets.uploadRejectedDescription')
            : code === 'file_too_large' || code === 'unsupported_file_type'
              ? policyDescription
              : t('assets.uploadFailedDescription')
      toast.error(file.name, {
        description,
        id: toastIdsRef.current.get(file),
      })
      toastIdsRef.current.delete(file)
    },
    onProgress: (file, progress, control) => {
      const id = toastIdsRef.current.get(file)
      if (id === undefined)
        return

      toast.loading(file.name, {
        action: getCancelAction(control),
        description: progressFormatter.format(progress),
        id,
      })
    },
    onStart: (file, control) =>
      toastIdsRef.current.set(
        file,
        toast.loading(file.name, {
          action: getCancelAction(control),
          description: progressFormatter.format(0),
        }),
      ),
  })
  const folderUpload = useAssetFolderUpload({
    createFolder,
    folders,
    parentFolderId: folderId,
    runBatch: uploader.runBatch,
    uploadFiles: uploader.uploadFilesInBatch,
  })

  async function uploadSelections(selections: AssetUploadSelection[]) {
    const acceptedSelections = selections.filter(selection =>
      isAcceptedAssetFile(selection.file),
    )

    if (acceptedSelections.length === 0) {
      toast.error(t('assets.noSupportedFiles'), {
        description: policyDescription,
      })
      return
    }

    try {
      await folderUpload.start(acceptedSelections)
    }
    catch (error) {
      if (isAssetUploadAbortError(error))
        return
      toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
    }
  }

  function uploadFiles(files: FileList | File[]) {
    return uploadSelections(getAssetUploadSelections(files))
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
