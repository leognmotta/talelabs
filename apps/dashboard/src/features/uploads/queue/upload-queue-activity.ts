/** Tenant and provider guards shared by upload scheduling and execution. */

import type { RuntimeUploadBatch } from '../upload-runtime'

import { uploadQueueState } from './upload-queue-state'

/** Returns whether an organization may currently mutate its upload queue. */
export function isUploadOrganizationActive(organizationId: string) {
  return uploadQueueState.activeOrganizationId === organizationId
    && !uploadQueueState.blockedOrganizations.has(organizationId)
}

/** Aborts work that outlived its batch, item, or active organization. */
export function assertUploadActive(
  batch: RuntimeUploadBatch,
  itemSignal?: AbortSignal,
) {
  if (
    batch.controller.signal.aborted
    || itemSignal?.aborted
    || !isUploadOrganizationActive(batch.organizationId)
  ) {
    throw new DOMException('Upload canceled', 'AbortError')
  }
}

/** Returns the mounted cache bridge required before folder preparation. */
export function requireUploadCache() {
  if (!uploadQueueState.cache)
    throw new Error('The upload cache adapter is not configured.')
  return uploadQueueState.cache
}
