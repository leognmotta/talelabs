import type { Asset } from '@talelabs/sdk'
import type { AssetUploadErrorCode } from './asset-upload'
import type {
  AssetUploadBatch,
  RunAssetUploadBatch,
} from './asset-upload-batch'

import { useCallback, useEffect, useRef } from 'react'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { AssetUploadError, uploadAsset } from './asset-upload'
import {
  createAssetUploadAbortError,
  isAssetUploadAbortError,
  throwIfAssetUploadBatchInactive,
} from './asset-upload-batch'

export interface AssetUploadFailure {
  code: AssetUploadErrorCode | 'upload_failed'
  file: File
}

export interface AssetUploadControl {
  cancel: () => void
}

export function useAssetUploader({
  folderId,
  onComplete,
  onCancel,
  onError,
  onProgress,
  onStart,
}: {
  folderId: null | string
  onComplete: (asset: Asset, file: File) => Promise<void> | void
  onCancel: (file: File) => void
  onError: (failure: AssetUploadFailure) => void
  onProgress: (
    file: File,
    progress: number,
    control: AssetUploadControl,
  ) => void
  onStart: (file: File, control: AssetUploadControl) => void
}) {
  const organizationId = useActiveOrganizationId()
  const batchControllersRef = useRef(new Set<AbortController>())
  const controllersRef = useRef(new Map<File, AbortController>())
  const folderIdRef = useRef(folderId)
  const organizationIdRef = useRef(organizationId)
  const previousOrganizationIdRef = useRef(organizationId)
  const onCompleteRef = useRef(onComplete)
  const onCancelRef = useRef(onCancel)
  const onErrorRef = useRef(onError)
  const onProgressRef = useRef(onProgress)
  const onStartRef = useRef(onStart)
  folderIdRef.current = folderId
  organizationIdRef.current = organizationId

  useEffect(() => {
    onCompleteRef.current = onComplete
    onCancelRef.current = onCancel
    onErrorRef.current = onError
    onProgressRef.current = onProgress
    onStartRef.current = onStart
  })

  const cancelAll = useCallback(() => {
    for (const controller of batchControllersRef.current)
      controller.abort()
    for (const controller of controllersRef.current.values())
      controller.abort()
  }, [])

  useEffect(() => {
    if (previousOrganizationIdRef.current !== organizationId)
      cancelAll()

    previousOrganizationIdRef.current = organizationId
  }, [cancelAll, organizationId])

  useEffect(() => () => cancelAll(), [cancelAll])

  const runBatch = useCallback<RunAssetUploadBatch>(async (operation) => {
    const capturedOrganizationId = organizationIdRef.current
    if (!capturedOrganizationId)
      throw createAssetUploadAbortError()

    const controller = new AbortController()
    const batch: AssetUploadBatch = {
      organizationId: capturedOrganizationId,
      signal: controller.signal,
    }
    batchControllersRef.current.add(controller)

    try {
      return await operation(batch)
    }
    finally {
      batchControllersRef.current.delete(controller)
    }
  }, [])

  const uploadFilesInBatch = useCallback(async (
    files: File[],
    targetFolderId: null | string,
    batch: AssetUploadBatch,
  ) => {
    for (const file of files) {
      throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)

      let asset: Asset
      let lastProgressPercentage = -1
      const controller = new AbortController()
      const abortFile = () => controller.abort()
      const control: AssetUploadControl = {
        cancel: () => controller.abort(),
      }
      controllersRef.current.set(file, controller)
      batch.signal.addEventListener('abort', abortFile, { once: true })
      if (batch.signal.aborted)
        controller.abort()
      onStartRef.current(file, control)

      try {
        throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)
        asset = await uploadAsset({
          file,
          folderId: targetFolderId,
          signal: controller.signal,
          onProgress: (progress) => {
            const normalizedProgress = Math.min(Math.max(progress, 0), 1)
            const progressPercentage = Math.round(normalizedProgress * 100)
            if (progressPercentage === lastProgressPercentage)
              return

            lastProgressPercentage = progressPercentage
            onProgressRef.current(file, normalizedProgress, control)
          },
        })
        throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)
      }
      catch (error) {
        if (isAssetUploadAbortError(error)) {
          onCancelRef.current(file)
          if (
            batch.signal.aborted
            || organizationIdRef.current !== batch.organizationId
          ) {
            break
          }
          continue
        }

        console.error('Asset upload failed.', { error, fileName: file.name })
        onErrorRef.current({
          code: error instanceof AssetUploadError ? error.code : 'upload_failed',
          file,
        })
        continue
      }
      finally {
        batch.signal.removeEventListener('abort', abortFile)
        controllersRef.current.delete(file)
      }

      throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)
      await onCompleteRef.current(asset, file)
    }
  }, [])

  const startInFolder = useCallback((
    files: File[],
    targetFolderId: null | string,
  ) => runBatch(batch => uploadFilesInBatch(files, targetFolderId, batch)), [
    runBatch,
    uploadFilesInBatch,
  ])

  const start = useCallback(
    (files: File[]) => startInFolder(files, folderIdRef.current),
    [startInFolder],
  )

  return { cancelAll, runBatch, start, startInFolder, uploadFilesInBatch }
}
