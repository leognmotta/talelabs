import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import { throwProviderResponseInvalid } from '../../errors.js'

const MEBIBYTE = 1024 * 1024
const IMAGE_MIME_TYPES = new Set([
  'image/bmp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
])
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime'])
const AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav'])

function finiteMetadata(value: number | null) {
  if (value === null || !Number.isFinite(value))
    throwProviderResponseInvalid()
  return value
}

export function validateSeedanceReferenceAsset(
  mediaType: 'audio' | 'image' | 'video',
  asset: ResolvedGenerationAsset,
) {
  const mimeType = asset.mimeType.toLowerCase()
  const sizeBytes = finiteMetadata(asset.sizeBytes)
  if (mediaType === 'image') {
    const width = finiteMetadata(asset.width)
    const height = finiteMetadata(asset.height)
    const aspectRatio = width / height
    if (
      !IMAGE_MIME_TYPES.has(mimeType)
      || sizeBytes >= 30 * MEBIBYTE
      || width <= 300
      || height <= 300
      || width >= 6_000
      || height >= 6_000
      || aspectRatio <= 0.4
      || aspectRatio >= 2.5
    ) {
      throwProviderResponseInvalid()
    }
    return 0
  }
  const durationSeconds = finiteMetadata(asset.durationSeconds)
  if (mediaType === 'audio') {
    if (
      !AUDIO_MIME_TYPES.has(mimeType)
      || sizeBytes > 15 * MEBIBYTE
      || durationSeconds < 2
      || durationSeconds > 15
    ) {
      throwProviderResponseInvalid()
    }
    return durationSeconds
  }
  const width = finiteMetadata(asset.width)
  const height = finiteMetadata(asset.height)
  const aspectRatio = width / height
  const pixels = width * height
  if (
    !VIDEO_MIME_TYPES.has(mimeType)
    || sizeBytes > 200 * MEBIBYTE
    || durationSeconds < 2
    || durationSeconds > 15
    || width < 300
    || height < 300
    || width > 6_000
    || height > 6_000
    || aspectRatio < 0.4
    || aspectRatio > 2.5
    || pixels < 409_600
    || pixels > 8_295_044
  ) {
    throwProviderResponseInvalid()
  }
  return durationSeconds
}

export function validateSeedanceReferenceDurations(input: {
  audioDurationSeconds: number
  videoDurationSeconds: number
}) {
  if (input.audioDurationSeconds > 15 || input.videoDurationSeconds > 15)
    throwProviderResponseInvalid()
}
