/** Client-side upload queue types: item/batch state and status. */

import type { Folder } from '@talelabs/sdk'

/** Lifecycle status of one queued upload item. */
export type UploadStatus
  = | 'canceled'
    | 'completed'
    | 'failed'
    | 'hashing'
    | 'queued'
    | 'registering'
    | 'uploading'

/** Kind of upload batch; only Asset uploads today. */
export type UploadBatchKind = 'assets'

/** The stage at which an upload failed. */
export type UploadFailureStage
  = | 'folder'
    | 'hashing'
    | 'registering'
    | 'uploading'

/** State of one enqueued upload batch. */
export interface UploadBatchState {
  createdAt: number
  destinationLabel: null | string
  id: string
  itemIds: string[]
  kind: UploadBatchKind
  organizationId: string
  projectId: null | string
}

/** State of one upload item within a batch. */
export interface UploadItemState {
  assetId?: string
  batchId: string
  destinationFolderId: null | string
  destinationLabel: null | string
  errorCode?: string
  failedStage?: UploadFailureStage
  filename: string
  id: string
  mimeType: string
  organizationId: string
  projectId: null | string
  progress: number
  relativePath: null | string
  sizeBytes: number
  status: UploadStatus
}

/** One selected file plus its relative path within a dropped folder. */
export interface AssetUploadInput {
  file: File
  relativePath: null | string
}

/** Minimal folder identity captured by directory-aware upload preparation. */
export type AssetUploadFolderSnapshot = Pick<
  Folder,
  'id' | 'name' | 'parentId'
>

/** Inputs to enqueue an Asset upload batch into the queue. */
export interface EnqueueAssetUploadBatchInput {
  destinationLabel: null | string
  files: AssetUploadInput[]
  folders: readonly AssetUploadFolderSnapshot[]
  organizationId: string
  parentFolderId: null | string
  /** Project captured when the batch is enqueued, or null for Private. */
  projectId?: null | string
}

/** Upload statuses that count as in-flight. */
export const ACTIVE_UPLOAD_STATUSES = new Set<UploadStatus>([
  'queued',
  'hashing',
  'uploading',
  'registering',
])

/** Whether an upload status is still in flight. */
export function isActiveUploadStatus(status: UploadStatus) {
  return ACTIVE_UPLOAD_STATUSES.has(status)
}

/** Whether an upload status is terminal (canceled/completed/failed). */
export function isSettledUploadStatus(status: UploadStatus) {
  return status === 'canceled' || status === 'completed' || status === 'failed'
}
