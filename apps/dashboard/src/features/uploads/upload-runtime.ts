/** Non-serializable Files, controllers, and retry metadata for queued uploads. */

import type { Folder } from '@talelabs/sdk'

/** File and retry data retained only while an item may still execute. */
export interface RuntimeUploadItem {
  /** Browser File intentionally excluded from serializable Zustand state. */
  file: File
  /** Last emitted integer percentage used to suppress noisy progress updates. */
  lastProgressPercentage: number
  /** Registration grant retained when a retry can skip hashing and transfer. */
  registrationUploadId?: string
}

/** Abort and folder-preparation state shared by every item in one batch. */
export interface RuntimeUploadBatch {
  /** Cancels folder preparation and every item execution in the batch. */
  controller: AbortController
  /** Existing folder snapshot used to avoid duplicate directory creation. */
  folders: Folder[]
  /** Stable batch ID shared with visible Zustand state. */
  id: string
  /** Tenant boundary captured when the batch was enqueued. */
  organizationId: string
  /** Root destination selected when the batch was enqueued. */
  parentFolderId: null | string
  /** Whether relative folder paths have resolved to canonical folder IDs. */
  prepared: boolean
}

/** Non-serializable queue state; Files and controllers never enter Zustand. */
export interface UploadRuntime {
  /** Abort and folder-preparation state keyed by visible batch ID. */
  batches: Map<string, RuntimeUploadBatch>
  /** Active per-item controllers keyed by visible item ID. */
  itemControllers: Map<string, AbortController>
  /** Files and retry metadata keyed by visible item ID. */
  items: Map<string, RuntimeUploadItem>
}

/** Creates empty process-local runtime state for the singleton queue. */
export function createUploadRuntime(): UploadRuntime {
  return {
    batches: new Map<string, RuntimeUploadBatch>(),
    itemControllers: new Map<string, AbortController>(),
    items: new Map<string, RuntimeUploadItem>(),
  }
}
