/** Maps upload failures into stable retry stages and user-facing error codes. */

import type { UploadFailureStage, UploadItemState } from '../upload.types'

import { getApiErrorCode } from '../../../shared/lib/api-error'
import {
  AssetUploadError,
} from '../../assets/upload/asset-upload-error'

/** Identifies cancellation errors emitted by browser upload primitives. */
export function isUploadAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** Preserves domain error codes while normalizing unknown pipeline failures. */
export function getUploadErrorCode(error: unknown) {
  if (error instanceof AssetUploadError)
    return error.code
  return getApiErrorCode(error) ?? 'upload_failed'
}

/** Captures the last durable retry boundary reached by an upload item. */
export function getUploadFailureStage(
  status: UploadItemState['status'],
): UploadFailureStage {
  if (status === 'linking' || status === 'registering' || status === 'uploading')
    return status
  return 'hashing'
}
