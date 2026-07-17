/** Retry, dismiss, and cleanup actions for items retained after queue settlement. */

import { removeUploadRuntimeItem } from '../upload-runtime-actions'
import { uploadStore } from '../upload-store'
import { isUploadOrganizationActive } from './upload-queue-activity'
import {
  clearOrphanedUploadBatches,
  scheduleUploads,
} from './upload-queue-scheduler'
import { uploadQueueState } from './upload-queue-state'

/** Requeues a failed item from its last safe upload or registration boundary. */
export function retryUploadItem(itemId: string) {
  const item = uploadStore.getState().items[itemId]
  if (
    !item
    || item.status !== 'failed'
    || !uploadQueueState.runtime.items.has(itemId)
  ) {
    return
  }
  if (!isUploadOrganizationActive(item.organizationId))
    return

  const batch = uploadQueueState.runtime.batches.get(item.batchId)
  if (batch && item.errorCode === 'folder_creation_failed')
    batch.prepared = false
  uploadStore.getState().patchItem(itemId, {
    errorCode: undefined,
    failedStage: undefined,
    progress: item.assetId
      ? 1
      : uploadQueueState.runtime.items.get(itemId)?.registrationUploadId ? 0.9 : 0,
    status: 'queued',
  })
  scheduleUploads()
}

/** Requeues every failed item retained by a visible batch. */
export function retryUploadBatch(batchId: string) {
  const batch = uploadStore.getState().batches[batchId]
  if (!batch)
    return
  for (const itemId of batch.itemIds)
    retryUploadItem(itemId)
}

/** Removes a failed item and discards the File needed for another retry. */
export function dismissUploadItem(itemId: string) {
  const item = uploadStore.getState().items[itemId]
  if (!item || item.status !== 'failed')
    return

  uploadQueueState.runtime.itemControllers.get(itemId)?.abort()
  removeUploadRuntimeItem(uploadQueueState.runtime, itemId)
  uploadStore.getState().removeItems([itemId])
  clearOrphanedUploadBatches()
}
