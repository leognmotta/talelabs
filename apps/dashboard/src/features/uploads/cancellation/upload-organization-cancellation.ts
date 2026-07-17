/** Tenant-boundary cancellation for organization switches, sign-out, and teardown. */

import { uploadQueueState } from '../queue/upload-queue-state'
import {
  removeUploadRuntimeBatch,
  removeUploadRuntimeItem,
} from '../upload-runtime-actions'
import { uploadStore } from '../upload-store'

/** Blocks new work and aborts every controller owned by one organization. */
export function blockAndAbortUploadOrganization(organizationId: string) {
  uploadQueueState.blockedOrganizations.add(organizationId)
  for (const batch of uploadQueueState.runtime.batches.values()) {
    if (batch.organizationId === organizationId)
      batch.controller.abort()
  }

  const state = uploadStore.getState()
  const itemIds = state.itemOrder.filter((id) => {
    const item = state.items[id]
    return item?.organizationId === organizationId
      && !['canceled', 'completed'].includes(item.status)
  })
  for (const itemId of itemIds) {
    uploadQueueState.runtime.itemControllers.get(itemId)?.abort()
    state.patchItem(itemId, {
      errorCode: undefined,
      failedStage: undefined,
      status: 'canceled',
    })
  }
}

/** Cancels one tenant and waits until its claimed worker releases runtime state. */
export async function cancelOrganizationUploads(
  organizationId: null | string,
) {
  if (!organizationId)
    return

  blockAndAbortUploadOrganization(organizationId)
  const running = uploadQueueState.runningOrganizationId === organizationId
    ? uploadQueueState.runningPromise
    : null
  if (running)
    await Promise.allSettled([running])

  for (const itemId of uploadQueueState.runtime.items.keys()) {
    const item = uploadStore.getState().items[itemId]
    if (item?.organizationId === organizationId)
      removeUploadRuntimeItem(uploadQueueState.runtime, itemId)
  }
  for (const [batchId, batch] of uploadQueueState.runtime.batches) {
    if (batch.organizationId === organizationId)
      removeUploadRuntimeBatch(uploadQueueState.runtime, batchId)
  }
}

/** Cancels uploads for every organization represented in the visible queue. */
export async function cancelAllUploads() {
  const organizationIds = new Set(
    Object.values(uploadStore.getState().batches)
      .map(batch => batch.organizationId),
  )
  await Promise.all(Array.from(organizationIds, organizationId =>
    cancelOrganizationUploads(organizationId)))
}
