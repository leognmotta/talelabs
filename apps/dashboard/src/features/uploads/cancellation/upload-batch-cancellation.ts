/** Waits for a running batch to observe cancellation before destructive work continues. */

import { uploadQueueState } from '../queue/upload-queue-state'
import { cancelUploadBatch } from './upload-item-cancellation'

/** Cancels matching batches and settles the claimed worker when it is included. */
export async function cancelUploadBatchesAndWait(
  batchIds: ReadonlySet<string>,
) {
  if (batchIds.size === 0)
    return

  const running = uploadQueueState.runningBatchId
    && batchIds.has(uploadQueueState.runningBatchId)
    ? uploadQueueState.runningPromise
    : null
  for (const batchId of batchIds)
    cancelUploadBatch(batchId)
  if (running)
    await Promise.allSettled([running])
}
