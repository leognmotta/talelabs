/** Prepares directory-upload folders before the queue starts transferring files. */

import type { RuntimeUploadBatch } from '../upload-runtime'

import { prepareAssetFolderBatch } from '../asset-folder-batch-preparer'
import { isUploadAbortError } from '../execution/upload-item-errors'
import { uploadStore } from '../upload-store'
import { assertUploadActive, requireUploadCache } from './upload-queue-activity'

/** Creates missing folder paths or marks every still-queued item retryable. */
export async function prepareUploadBatch(batch: RuntimeUploadBatch) {
  const cache = requireUploadCache()
  try {
    await prepareAssetFolderBatch(
      batch,
      cache,
      () => assertUploadActive(batch),
    )
  }
  catch (error) {
    if (isUploadAbortError(error) || batch.controller.signal.aborted)
      return
    const itemIds = uploadStore.getState().batches[batch.id]?.itemIds ?? []
    for (const itemId of itemIds) {
      const item = uploadStore.getState().items[itemId]
      if (item?.status === 'queued') {
        uploadStore.getState().patchItem(itemId, {
          errorCode: 'folder_creation_failed',
          failedStage: 'folder',
          status: 'failed',
        })
      }
    }
    console.error('Asset upload folder preparation failed.', {
      batchId: batch.id,
      error,
    })
  }
}
