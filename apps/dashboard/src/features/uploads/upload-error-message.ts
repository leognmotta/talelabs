import type { TFunction } from 'i18next'
import type { UploadItemState } from './upload.types'

export function getUploadErrorMessage(t: TFunction, item: UploadItemState) {
  if (item.failedStage === 'linking')
    return t('elements.assetLinkFailedDescription')

  switch (item.errorCode) {
    case 'element_asset_role_capacity_reached':
    case 'element_master_role_capacity_reached':
      return t('uploads.errors.elementLimit')
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
