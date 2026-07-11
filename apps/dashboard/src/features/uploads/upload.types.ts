import type { Folder } from '@talelabs/sdk'

export type UploadStatus
  = | 'canceled'
    | 'completed'
    | 'failed'
    | 'hashing'
    | 'linking'
    | 'queued'
    | 'registering'
    | 'uploading'

export type UploadBatchKind = 'assets' | 'element'

export type UploadFailureStage
  = | 'folder'
    | 'hashing'
    | 'linking'
    | 'registering'
    | 'uploading'

export interface UploadBatchState {
  createdAt: number
  destinationLabel: null | string
  id: string
  itemIds: string[]
  kind: UploadBatchKind
  organizationId: string
}

export interface UploadItemState {
  assetId?: string
  batchId: string
  destinationFolderId: null | string
  destinationLabel: null | string
  elementId?: string
  errorCode?: string
  failedStage?: UploadFailureStage
  filename: string
  id: string
  mimeType: string
  organizationId: string
  progress: number
  relativePath: null | string
  role?: string
  sizeBytes: number
  status: UploadStatus
}

export interface AssetUploadInput {
  file: File
  relativePath: null | string
}

export interface EnqueueAssetUploadBatchInput {
  destinationLabel: null | string
  files: AssetUploadInput[]
  folders: Folder[]
  organizationId: string
  parentFolderId: null | string
}

export interface ElementAssetUploadInput {
  clientId?: string
  file: File
  isPrimary: boolean
  role: string
  sortOrder: number
}

export interface EnqueueElementUploadBatchInput {
  destinationLabel: null | string
  elementId: string
  files: ElementAssetUploadInput[]
  folderId: null | string
  organizationId: string
}

export const ACTIVE_UPLOAD_STATUSES = new Set<UploadStatus>([
  'queued',
  'hashing',
  'uploading',
  'registering',
  'linking',
])

export function isActiveUploadStatus(status: UploadStatus) {
  return ACTIVE_UPLOAD_STATUSES.has(status)
}

export function isSettledUploadStatus(status: UploadStatus) {
  return status === 'canceled' || status === 'completed' || status === 'failed'
}
