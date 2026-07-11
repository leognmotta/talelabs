import {
  ACCEPTED_ASSET_MEDIA_TYPES,
  getAssetUploadValidationError,
} from '@talelabs/assets'

export { ACCEPTED_ASSET_MEDIA_TYPES } from '@talelabs/assets'

export const ACCEPTED_ASSET_MEDIA = ACCEPTED_ASSET_MEDIA_TYPES.join(',')

export function getAssetFileValidationError(file: File) {
  return getAssetUploadValidationError({
    mimeType: file.type,
    sizeBytes: file.size,
  })
}

export function isAcceptedAssetFile(file: File) {
  return getAssetFileValidationError(file) === null
}

export function getAcceptedAssetFiles(files: File[] | FileList) {
  return Array.from(files).filter(isAcceptedAssetFile)
}
