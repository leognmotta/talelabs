/** Resolves folder deletion targets into upload batches to cancel. */

import { assetFolderBatchTargetsFolders } from '../asset-folder-batch-preparer'
import { uploadQueueState } from '../queue/upload-queue-state'
import { uploadStore } from '../upload-store'
import { cancelUploadBatchesAndWait } from './upload-batch-cancellation'

/** Cancels directory batches whose destination intersects a deleted folder tree. */
export async function cancelFolderUploads(
  organizationId: string,
  folderIds: Iterable<string>,
) {
  const targetFolderIds = new Set(folderIds)
  if (targetFolderIds.size === 0)
    return

  const state = uploadStore.getState()
  const batchIds = new Set(state.batchOrder.filter((batchId) => {
    const visibleBatch = state.batches[batchId]
    const runtimeBatch = uploadQueueState.runtime.batches.get(batchId)
    return visibleBatch?.organizationId === organizationId
      && runtimeBatch !== undefined
      && assetFolderBatchTargetsFolders(runtimeBatch, targetFolderIds)
  }))
  await cancelUploadBatchesAndWait(batchIds)
}
