/** Immediate cancellation for individual queue items and visible batches. */

import {
  clearOrphanedUploadBatches,
  scheduleUploads,
} from '../queue/upload-queue-scheduler'
import { uploadQueueState } from '../queue/upload-queue-state'
import { removeUploadRuntimeItem } from '../upload-runtime-actions'
import { uploadStore } from '../upload-store'

/** Aborts one active item and removes its non-serializable retry state. */
export function cancelUploadItem(itemId: string) {
  const item = uploadStore.getState().items[itemId]
  if (!item || item.status === 'completed' || item.status === 'canceled')
    return

  uploadQueueState.runtime.itemControllers.get(itemId)?.abort()
  uploadStore.getState().patchItem(itemId, {
    errorCode: undefined,
    failedStage: undefined,
    status: 'canceled',
  })
  removeUploadRuntimeItem(uploadQueueState.runtime, itemId)
  clearOrphanedUploadBatches()
  scheduleUploads()
}

/** Aborts a batch controller and cancels each still-visible item in that batch. */
export function cancelUploadBatch(batchId: string) {
  const batch = uploadStore.getState().batches[batchId]
  if (!batch)
    return

  uploadQueueState.runtime.batches.get(batchId)?.controller.abort()
  for (const itemId of batch.itemIds)
    cancelUploadItem(itemId)
}
