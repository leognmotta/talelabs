export type AssetMediaType = 'audio' | 'image' | 'video'

export interface AssetUploadPolicy {
  maxSizeBytes: number
  type: AssetMediaType
}

const MEBIBYTE = 1024 * 1024

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

export type AssetUploadMimeType = keyof typeof ASSET_UPLOAD_POLICIES

export const ACCEPTED_ASSET_MEDIA_TYPES = Object.freeze(
  Object.keys(ASSET_UPLOAD_POLICIES) as AssetUploadMimeType[],
)

export function getAssetUploadPolicy(mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase() as AssetUploadMimeType
  return ASSET_UPLOAD_POLICIES[normalizedMimeType] as
    | AssetUploadPolicy
    | undefined
}

export function getAssetUploadMaxSizeBytes(type: AssetMediaType) {
  return Math.max(
    ...Object.values(ASSET_UPLOAD_POLICIES)
      .filter(policy => policy.type === type)
      .map(policy => policy.maxSizeBytes),
  )
}

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
