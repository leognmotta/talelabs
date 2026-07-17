/** Executes one queued file through upload, registration, linking, and cleanup. */

import type { RuntimeUploadBatch, RuntimeUploadItem } from '../upload-runtime'

import { uploadAsset } from '../../assets/upload/asset-upload'
import {
  shouldRestartUploadAfterRegistrationError,
} from '../../assets/upload/asset-upload-error'
import { linkElementUploadTarget } from '../element-upload-target'
import {
  assertUploadActive,
  isUploadOrganizationActive,
} from '../queue/upload-queue-activity'
import { uploadQueueState } from '../queue/upload-queue-state'
import {
  refreshElementLinkCache,
  refreshRegisteredAssetCache,
} from '../upload-cache-reconciliation'
import { removeUploadRuntimeItem } from '../upload-runtime-actions'
import { uploadStore } from '../upload-store'
import {
  getUploadErrorCode,
  getUploadFailureStage,
  isUploadAbortError,
} from './upload-item-errors'

const UPLOAD_STAGE_START: Record<'hashing' | 'registering' | 'uploading', number> = {
  hashing: 0,
  uploading: 0.2,
  registering: 0.9,
}

function updateUploadProgress(
  itemId: string,
  runtime: RuntimeUploadItem,
  progress: number,
) {
  const normalized = Math.min(Math.max(progress, 0), 1)
  const percentage = Math.round(normalized * 100)
  if (percentage === runtime.lastProgressPercentage)
    return
  runtime.lastProgressPercentage = percentage
  uploadStore.getState().patchItem(itemId, { progress: normalized })
}

/**
 * Runs a single queue item and retains enough runtime state to retry only the
 * stage that failed instead of uploading an already committed Asset again.
 */
export async function executeUploadItem(
  itemId: string,
  batch: RuntimeUploadBatch,
) {
  const runtime = uploadQueueState.runtime.items.get(itemId)
  const initialItem = uploadStore.getState().items[itemId]
  if (!runtime || !initialItem)
    return

  const controller = new AbortController()
  const abortItem = () => controller.abort()
  batch.controller.signal.addEventListener('abort', abortItem, { once: true })
  uploadQueueState.runtime.itemControllers.set(itemId, controller)

  try {
    assertUploadActive(batch, controller.signal)
    let assetId = initialItem.assetId
    const recoveringElementLink = Boolean(
      runtime.target.kind === 'element'
      && (assetId || runtime.registrationUploadId),
    )
    if (!assetId) {
      const asset = await uploadAsset({
        elementId: runtime.target.kind === 'element'
          ? runtime.target.elementId
          : undefined,
        file: runtime.file,
        folderId: initialItem.destinationFolderId,
        isPrimary: runtime.target.kind === 'element'
          ? runtime.target.isPrimary
          : undefined,
        organizationId: batch.organizationId,
        registrationUploadId: runtime.registrationUploadId,
        role: runtime.target.kind === 'element'
          ? runtime.target.role
          : undefined,
        signal: controller.signal,
        sortOrder: runtime.target.kind === 'element'
          ? runtime.target.sortOrder
          : undefined,
        onProgress: progress => updateUploadProgress(itemId, runtime, progress),
        onRegistrationReady: (uploadId) => {
          runtime.registrationUploadId = uploadId
        },
        onStageChange: status => uploadStore.getState().patchItem(itemId, {
          progress: Math.max(
            uploadStore.getState().items[itemId]?.progress ?? 0,
            UPLOAD_STAGE_START[status],
          ),
          status,
        }),
      })
      assertUploadActive(batch, controller.signal)
      assetId = asset.id
      uploadStore.getState().patchItem(itemId, { assetId, progress: 1 })
      await refreshRegisteredAssetCache(batch, asset)
      assertUploadActive(batch, controller.signal)
      if (runtime.target.kind === 'element') {
        await refreshElementLinkCache(
          batch,
          runtime.target.elementId,
          asset.id,
        )
        assertUploadActive(batch, controller.signal)
      }
    }

    // Existing Asset IDs and retried registration grants may predate atomic
    // registration or a response may have been lost after commit. Reconcile
    // only those recovery paths; fresh uploads were linked by POST /assets.
    if (runtime.target.kind === 'element' && recoveringElementLink) {
      uploadStore.getState().patchItem(itemId, {
        progress: 1,
        status: 'linking',
      })
      await linkElementUploadTarget(
        runtime.target,
        assetId,
        batch.organizationId,
        controller.signal,
      )
      assertUploadActive(batch, controller.signal)
      await refreshElementLinkCache(batch, runtime.target.elementId, assetId)
      assertUploadActive(batch, controller.signal)
    }

    uploadStore.getState().patchItem(itemId, {
      errorCode: undefined,
      failedStage: undefined,
      progress: 1,
      status: 'completed',
    })
    removeUploadRuntimeItem(uploadQueueState.runtime, itemId)
  }
  catch (error) {
    const current = uploadStore.getState().items[itemId]
    if (
      current?.status === 'canceled'
      || controller.signal.aborted
      || batch.controller.signal.aborted
      || isUploadAbortError(error)
      || !isUploadOrganizationActive(batch.organizationId)
    ) {
      uploadStore.getState().patchItem(itemId, {
        errorCode: undefined,
        failedStage: undefined,
        status: 'canceled',
      })
      removeUploadRuntimeItem(uploadQueueState.runtime, itemId)
      return
    }

    if (shouldRestartUploadAfterRegistrationError(error))
      runtime.registrationUploadId = undefined

    uploadStore.getState().patchItem(itemId, {
      errorCode: getUploadErrorCode(error),
      failedStage: getUploadFailureStage(current?.status ?? 'queued'),
      status: 'failed',
    })
    console.error('Asset upload pipeline failed.', {
      error,
      filename: current?.filename,
      itemId,
      status: current?.status,
    })
  }
  finally {
    batch.controller.signal.removeEventListener('abort', abortItem)
    uploadQueueState.runtime.itemControllers.delete(itemId)
  }
}
