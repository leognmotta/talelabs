/** Converts Asset and dormant Element selections into visible and runtime batches. */

import type { Folder } from '@talelabs/sdk'
import type { UploadTarget } from '../element-upload-target'
import type {
  AssetUploadInput,
  EnqueueAssetUploadBatchInput,
  EnqueueElementUploadBatchInput,
  UploadBatchState,
  UploadItemState,
} from '../upload.types'

import { uploadStore } from '../upload-store'
import { isUploadOrganizationActive } from './upload-queue-activity'
import { scheduleUploads } from './upload-queue-scheduler'
import { uploadQueueState } from './upload-queue-state'

function addUploadBatch<T extends AssetUploadInput | (AssetUploadInput & {
  clientId?: string
  target: Extract<UploadTarget, { kind: 'element' }>
})>(input: {
  destinationLabel: null | string
  files: T[]
  folders: Folder[]
  kind: UploadBatchState['kind']
  organizationId: string
  parentFolderId: null | string
  toRuntimeTarget: (input: T) => UploadTarget
}) {
  if (input.files.length === 0)
    return null

  const batchId = crypto.randomUUID()
  const itemIds: string[] = []
  const items: UploadItemState[] = input.files.map((entry) => {
    const itemId = 'clientId' in entry && entry.clientId
      ? entry.clientId
      : crypto.randomUUID()
    const target = input.toRuntimeTarget(entry)
    itemIds.push(itemId)
    uploadQueueState.runtime.items.set(itemId, {
      file: entry.file,
      lastProgressPercentage: -1,
      target,
    })
    return {
      batchId,
      destinationFolderId: input.parentFolderId,
      destinationLabel: input.destinationLabel,
      elementId: target.kind === 'element' ? target.elementId : undefined,
      filename: entry.file.name,
      id: itemId,
      mimeType: entry.file.type,
      organizationId: input.organizationId,
      progress: 0,
      relativePath: entry.relativePath,
      role: target.kind === 'element' ? target.role : undefined,
      sizeBytes: entry.file.size,
      status: 'queued',
    }
  })
  const batch: UploadBatchState = {
    createdAt: Date.now(),
    destinationLabel: input.destinationLabel,
    id: batchId,
    itemIds,
    kind: input.kind,
    organizationId: input.organizationId,
  }
  uploadQueueState.runtime.batches.set(batchId, {
    controller: new AbortController(),
    folders: input.folders,
    id: batchId,
    organizationId: input.organizationId,
    parentFolderId: input.parentFolderId,
    prepared: input.kind === 'element'
      || items.every(item => item.relativePath === null),
  })
  uploadStore.getState().addBatch(batch, items)
  scheduleUploads()
  return batchId
}

/** Enqueues ordinary files and directory selections under one Asset folder. */
export function enqueueAssetUploadBatch(input: EnqueueAssetUploadBatchInput) {
  if (!isUploadOrganizationActive(input.organizationId))
    return null
  return addUploadBatch({
    destinationLabel: input.destinationLabel,
    files: input.files,
    folders: input.folders,
    kind: 'assets',
    organizationId: input.organizationId,
    parentFolderId: input.parentFolderId,
    toRuntimeTarget: () => ({ kind: 'asset' }),
  })
}

/** Enqueues dormant Element references while retaining their link intent. */
export function enqueueElementUploadBatch(input: EnqueueElementUploadBatchInput) {
  if (!isUploadOrganizationActive(input.organizationId))
    return null
  return addUploadBatch({
    destinationLabel: input.destinationLabel,
    files: input.files.map(item => ({
      clientId: item.clientId,
      file: item.file,
      relativePath: null,
      target: {
        elementId: input.elementId,
        isPrimary: item.isPrimary,
        kind: 'element' as const,
        role: item.role,
        sortOrder: item.sortOrder,
      },
    })),
    folders: [],
    kind: 'element',
    organizationId: input.organizationId,
    parentFolderId: input.folderId,
    toRuntimeTarget: item => item.target,
  })
}
