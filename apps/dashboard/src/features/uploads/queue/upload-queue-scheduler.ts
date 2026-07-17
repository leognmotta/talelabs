/** Single-flight scheduler for the process-local upload queue. */

import { executeUploadItem } from '../execution/upload-item-execution'
import { removeUploadRuntimeBatch } from '../upload-runtime-actions'
import { uploadStore } from '../upload-store'
import { prepareUploadBatch } from './upload-batch-preparation'
import { uploadQueueState } from './upload-queue-state'

/** Removes runtime batches only after their final item and worker have settled. */
export function clearOrphanedUploadBatches() {
  const state = uploadStore.getState()
  for (const batchId of uploadQueueState.runtime.batches.keys()) {
    const visibleBatch = state.batches[batchId]
    const hasRuntimeItems = visibleBatch?.itemIds.some(id =>
      uploadQueueState.runtime.items.has(id)) ?? false
    if (!hasRuntimeItems && !uploadQueueState.runningPromise)
      removeUploadRuntimeBatch(uploadQueueState.runtime, batchId)
  }
}

/** Coalesces queue wakeups so concurrent enqueue/cancel actions start one pump. */
export function scheduleUploads() {
  if (uploadQueueState.scheduled)
    return
  uploadQueueState.scheduled = true
  queueMicrotask(() => {
    uploadQueueState.scheduled = false
    void pumpUploads()
  })
}

/** Claims the next queued item for the active organization and runs it alone. */
export async function pumpUploads() {
  if (uploadQueueState.runningPromise)
    return
  const organizationId = uploadQueueState.activeOrganizationId
  if (!organizationId || uploadQueueState.blockedOrganizations.has(organizationId))
    return

  const state = uploadStore.getState()
  const item = state.itemOrder
    .map(id => state.items[id])
    .find(candidate => candidate?.organizationId === organizationId
      && candidate.status === 'queued')
  if (!item)
    return

  const batch = uploadQueueState.runtime.batches.get(item.batchId)
  if (!batch)
    return

  uploadQueueState.runningOrganizationId = organizationId
  uploadQueueState.runningBatchId = batch.id
  uploadQueueState.runningPromise = (batch.prepared
    ? executeUploadItem(item.id, batch)
    : prepareUploadBatch(batch))
    .finally(() => {
      uploadQueueState.runningPromise = null
      uploadQueueState.runningBatchId = null
      uploadQueueState.runningOrganizationId = null
      clearOrphanedUploadBatches()
      scheduleUploads()
    })
  await uploadQueueState.runningPromise
}
