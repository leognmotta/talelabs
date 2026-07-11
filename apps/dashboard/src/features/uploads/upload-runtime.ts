import type { Folder } from '@talelabs/sdk'
import type { UploadTarget } from './element-upload-target'

export interface RuntimeUploadItem {
  file: File
  lastProgressPercentage: number
  registrationUploadId?: string
  target: UploadTarget
}

export interface RuntimeUploadBatch {
  controller: AbortController
  folders: Folder[]
  id: string
  organizationId: string
  parentFolderId: null | string
  prepared: boolean
}

/** Non-serializable queue state. Files and controllers never enter Zustand. */
export class UploadRuntime {
  readonly batches = new Map<string, RuntimeUploadBatch>()
  readonly itemControllers = new Map<string, AbortController>()
  readonly items = new Map<string, RuntimeUploadItem>()

  abortBatch(batchId: string) {
    this.batches.get(batchId)?.controller.abort()
  }

  abortItem(itemId: string) {
    this.itemControllers.get(itemId)?.abort()
  }

  clear() {
    this.batches.clear()
    this.itemControllers.clear()
    this.items.clear()
  }

  removeBatch(batchId: string) {
    this.batches.delete(batchId)
  }

  removeItem(itemId: string) {
    this.itemControllers.delete(itemId)
    this.items.delete(itemId)
  }

  removeItemController(itemId: string) {
    this.itemControllers.delete(itemId)
  }
}
