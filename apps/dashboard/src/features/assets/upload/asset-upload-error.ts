/** Asset upload error codes and retry classification shared with the global queue. */

import { getApiErrorCode } from '../../../shared/lib/api-error'

const RESTART_UPLOAD_REGISTRATION_ERROR_CODES = new Set([
  'invalid_upload_grant',
  'upload_mismatch',
  'upload_missing',
])

/** Stable upload errors translated by queue and feature-level UI. */
export type AssetUploadErrorCode
  = | 'element_asset_role_capacity_reached'
    | 'element_master_role_capacity_reached'
    | 'file_too_large'
    | 'storage_request_blocked'
    | 'storage_upload_rejected'
    | 'unsupported_file_type'

/** Error carrying a stable code while upload implementation messages remain internal. */
export class AssetUploadError extends Error {
  /** Machine-readable code used by upload retry and localized UI handling. */
  readonly code: AssetUploadErrorCode

  constructor(message: string, code: AssetUploadErrorCode) {
    super(message)
    this.name = 'AssetUploadError'
    this.code = code
  }
}

/** Reports whether registration must restart from a fresh upload grant. */
export function shouldRestartUploadAfterRegistrationError(error: unknown) {
  const code = error instanceof AssetUploadError
    ? error.code
    : getApiErrorCode(error)
  return code !== null && RESTART_UPLOAD_REGISTRATION_ERROR_CODES.has(code)
}
