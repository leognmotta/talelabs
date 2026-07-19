/** Converts Asset file selections into visible and runtime upload batches. */

import type {
  EnqueueAssetUploadBatchInput,
  UploadBatchState,
  UploadItemState,
} from '../upload.types'

import { uploadStore } from '../upload-store'
import { isUploadOrganizationActive } from './upload-queue-activity'
import { scheduleUploads } from './upload-queue-scheduler'
import { uploadQueueState } from './upload-queue-state'

/** Enqueues ordinary files and directory selections under one Asset folder. */
export function enqueueAssetUploadBatch(input: EnqueueAssetUploadBatchInput) {
  if (!isUploadOrganizationActive(input.organizationId))
    return null
  if (input.files.length === 0)
    return null

  const batchId = crypto.randomUUID()
  const itemIds: string[] = []
  const items: UploadItemState[] = input.files.map((entry) => {
    const itemId = crypto.randomUUID()
    itemIds.push(itemId)
    uploadQueueState.runtime.items.set(itemId, {
      file: entry.file,
      lastProgressPercentage: -1,
    })
    return {
      batchId,
      destinationFolderId: input.parentFolderId,
      destinationLabel: input.destinationLabel,
      filename: entry.file.name,
      id: itemId,
      mimeType: entry.file.type,
      organizationId: input.organizationId,
      progress: 0,
      relativePath: entry.relativePath,
      sizeBytes: entry.file.size,
      status: 'queued',
    }
  })
  const batch: UploadBatchState = {
    createdAt: Date.now(),
    destinationLabel: input.destinationLabel,
    id: batchId,
    itemIds,
    kind: 'assets',
    organizationId: input.organizationId,
  }
  uploadQueueState.runtime.batches.set(batchId, {
    controller: new AbortController(),
    folders: input.folders,
    id: batchId,
    organizationId: input.organizationId,
    parentFolderId: input.parentFolderId,
    prepared: items.every(item => item.relativePath === null),
  })
  uploadStore.getState().addBatch(batch, items)
  scheduleUploads()
  return batchId
}
