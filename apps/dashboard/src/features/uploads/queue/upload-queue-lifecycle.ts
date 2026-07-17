/** Mount and organization lifecycle for the process-local upload queue. */

import type { UploadCacheAdapter } from '../upload-cache'

import {
  blockAndAbortUploadOrganization,
  cancelAllUploads,
} from '../cancellation/upload-organization-cancellation'
import { clearUploadRuntime } from '../upload-runtime-actions'
import { uploadStore } from '../upload-store'
import { scheduleUploads } from './upload-queue-scheduler'
import { uploadQueueState } from './upload-queue-state'

/** Installs the current Query cache bridge and returns its mount generation. */
export function configureUploadQueue(cache: UploadCacheAdapter) {
  uploadQueueState.cache = cache
  uploadQueueState.configurationVersion += 1
  return uploadQueueState.configurationVersion
}

/** Activates one tenant and aborts work belonging to the previous tenant. */
export function setActiveUploadOrganization(organizationId: null | string) {
  const previousOrganizationId = uploadQueueState.activeOrganizationId
  uploadQueueState.activeOrganizationId = organizationId
  if (organizationId)
    uploadQueueState.blockedOrganizations.delete(organizationId)

  if (previousOrganizationId && previousOrganizationId !== organizationId)
    blockAndAbortUploadOrganization(previousOrganizationId)

  scheduleUploads()
}

/** Tears down the queue only when cleanup belongs to the latest provider mount. */
export async function shutdownUploadQueue(
  configurationVersion = uploadQueueState.configurationVersion,
) {
  if (configurationVersion !== uploadQueueState.configurationVersion)
    return
  uploadQueueState.activeOrganizationId = null
  await cancelAllUploads()
  if (configurationVersion !== uploadQueueState.configurationVersion)
    return
  clearUploadRuntime(uploadQueueState.runtime)
  uploadStore.getState().clear()
  uploadQueueState.cache = null
}
