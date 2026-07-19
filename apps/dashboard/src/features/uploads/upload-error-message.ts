/** Maps upload error codes to localized user-facing messages. */

import type { TFunction } from 'i18next'
import type { UploadItemState } from './upload.types'

/** Resolves a localized message for one failed upload item's error code. */
export function getUploadErrorMessage(t: TFunction, item: UploadItemState) {
  switch (item.errorCode) {
    case 'file_too_large':
      return t('uploads.errors.fileTooLarge')
    case 'folder_creation_failed':
      return t('uploads.errors.folderCreation')
    case 'storage_request_blocked':
      return t('uploads.errors.storageBlocked')
    case 'storage_upload_rejected':
      return t('uploads.errors.storageRejected')
    case 'unsupported_file_type':
      return t('uploads.errors.unsupportedType')
    default:
      return t('uploads.errors.generic')
  }
}
