/** Destructive updates for non-serializable upload runtime maps. */

import type { UploadRuntime } from './upload-runtime'

/** Clears every File, controller, and batch record during provider teardown. */
export function clearUploadRuntime(runtime: UploadRuntime) {
  runtime.batches.clear()
  runtime.itemControllers.clear()
  runtime.items.clear()
}

/** Removes a batch after no visible item retains runtime work. */
export function removeUploadRuntimeBatch(
  runtime: UploadRuntime,
  batchId: string,
) {
  runtime.batches.delete(batchId)
}

/** Removes one File and its controller after completion, cancellation, or dismissal. */
export function removeUploadRuntimeItem(
  runtime: UploadRuntime,
  itemId: string,
) {
  runtime.itemControllers.delete(itemId)
  runtime.items.delete(itemId)
}
