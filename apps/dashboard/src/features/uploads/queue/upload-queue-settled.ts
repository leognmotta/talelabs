/** Removes completed and canceled presentation state after users review it. */

import { removeUploadRuntimeItem } from '../upload-runtime-actions'
import { uploadStore } from '../upload-store'
import { clearOrphanedUploadBatches } from './upload-queue-scheduler'
import { uploadQueueState } from './upload-queue-state'

/** Clears settled items for one organization without discarding failed retries. */
export function clearSettledUploads(organizationId: string) {
  const state = uploadStore.getState()
  const removedIds = state.itemOrder.filter((id) => {
    const item = state.items[id]
    return item?.organizationId === organizationId
      && (item.status === 'completed' || item.status === 'canceled')
  })
  for (const itemId of removedIds)
    removeUploadRuntimeItem(uploadQueueState.runtime, itemId)
  state.clearSettled(organizationId)
  clearOrphanedUploadBatches()
}
