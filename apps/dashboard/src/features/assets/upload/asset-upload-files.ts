/** Canonical browser-file admission policy for supported Asset media types. */

import {
  ACCEPTED_ASSET_MEDIA_TYPES,
  getAssetUploadValidationError,
} from '@talelabs/assets'

export { ACCEPTED_ASSET_MEDIA_TYPES } from '@talelabs/assets'

/** File-picker accept map derived from every media type allowed by the upload policy. */
export const ACCEPTED_ASSET_MEDIA = ACCEPTED_ASSET_MEDIA_TYPES.join(',')

/** Returns the stable validation code for a file that violates upload policy. */
export function getAssetFileValidationError(file: File) {
  return getAssetUploadValidationError({
    mimeType: file.type,
    sizeBytes: file.size,
  })
}

/** Reports whether a file satisfies current MIME and size policy. */
export function isAcceptedAssetFile(file: File) {
  return getAssetFileValidationError(file) === null
}

/** Filters a browser selection to files that can enter the upload queue. */
export function getAcceptedAssetFiles(files: File[] | FileList) {
  return Array.from(files).filter(isAcceptedAssetFile)
}
