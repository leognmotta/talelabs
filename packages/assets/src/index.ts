/**
 * Shared Asset and Element vocabulary: types, upload policies, and limits.
 *
 * @packageDocumentation
 */

/** Media family accepted by the upload pipeline. */
export type AssetMediaType = 'audio' | 'image' | 'video'

/** Size limit and media family for one accepted MIME type. */
export interface AssetUploadPolicy {
  maxSizeBytes: number
  type: AssetMediaType
}

const MEBIBYTE = 1024 * 1024

/** Accepted upload MIME types with their per-type size limits. */
export const ASSET_UPLOAD_POLICIES = {
  'audio/aac': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'audio/flac': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'audio/m4a': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'audio/mp4': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'audio/mpeg': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'audio/ogg': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'audio/wav': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'audio/x-wav': { maxSizeBytes: 100 * MEBIBYTE, type: 'audio' },
  'image/avif': { maxSizeBytes: 50 * MEBIBYTE, type: 'image' },
  'image/gif': { maxSizeBytes: 50 * MEBIBYTE, type: 'image' },
  'image/jpeg': { maxSizeBytes: 50 * MEBIBYTE, type: 'image' },
  'image/png': { maxSizeBytes: 50 * MEBIBYTE, type: 'image' },
  'image/webp': { maxSizeBytes: 50 * MEBIBYTE, type: 'image' },
  'video/mp4': { maxSizeBytes: 500 * MEBIBYTE, type: 'video' },
  'video/quicktime': { maxSizeBytes: 500 * MEBIBYTE, type: 'video' },
  'video/webm': { maxSizeBytes: 500 * MEBIBYTE, type: 'video' },
} as const satisfies Record<string, AssetUploadPolicy>

/** MIME type with a defined upload policy. */
export type AssetUploadMimeType = keyof typeof ASSET_UPLOAD_POLICIES

/** Every MIME type the upload pipeline accepts. */
export const ACCEPTED_ASSET_MEDIA_TYPES = Object.freeze(
  Object.keys(ASSET_UPLOAD_POLICIES) as AssetUploadMimeType[],
)

export { ensureAssetFileExtension } from './asset-file-extension.js'
export {
  ELEMENT_KINDS,
  type ElementKind,
  isElementKind,
  MAX_ELEMENT_REFERENCES,
} from './element-kinds.js'

/** Looks up the upload policy for a MIME type, case-insensitively. */
export function getAssetUploadPolicy(mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase() as AssetUploadMimeType
  return ASSET_UPLOAD_POLICIES[normalizedMimeType] as
    | AssetUploadPolicy
    | undefined
}

/** Largest accepted upload size across one media family. */
export function getAssetUploadMaxSizeBytes(type: AssetMediaType) {
  return Math.max(
    ...Object.values(ASSET_UPLOAD_POLICIES)
      .filter(policy => policy.type === type)
      .map(policy => policy.maxSizeBytes),
  )
}

/** Returns the rejection reason for an upload candidate, or null. */
export function getAssetUploadValidationError(input: {
  mimeType: string
  sizeBytes: number
}) {
  const policy = getAssetUploadPolicy(input.mimeType)

  if (!policy)
    return 'unsupported_file_type' as const
  if (input.sizeBytes > policy.maxSizeBytes)
    return 'file_too_large' as const

  return null
}
