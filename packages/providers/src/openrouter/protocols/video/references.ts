/**
 * Reference validation and mapping for OpenRouter video generation.
 *
 */

import type { CatalogVideoRequestProfile } from '@talelabs/models-catalog'
import type { OpenRouterAssetResolver, ResolvedOpenRouterAsset } from '../../types.js'
import type {
  OpenRouterVideoReference,
  OrderedVideoMediaInput,
} from './types.js'

import { throwProviderResponseInvalid } from '../../errors.js'

const MEBIBYTE = 1024 * 1024
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime'])
const AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/x-wav'])
const EXPECTED_MEDIA_TYPE = {
  audioReferences: 'audio',
  imageReferences: 'image',
  videoReferences: 'video',
} as const

function finiteMetadata(value: number | null) {
  if (value === null || !Number.isFinite(value))
    throwProviderResponseInvalid()
  return value
}

function validateSeedanceReferenceAsset(
  mediaType: 'audio' | 'image' | 'video',
  asset: ResolvedOpenRouterAsset,
) {
  const mimeType = asset.mimeType.toLowerCase()
  const sizeBytes = finiteMetadata(asset.sizeBytes)
  if (mediaType === 'image') {
    const width = finiteMetadata(asset.width)
    const height = finiteMetadata(asset.height)
    const aspectRatio = width / height
    if (
      !IMAGE_MIME_TYPES.has(mimeType)
      || sizeBytes > 30 * MEBIBYTE
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
    || sizeBytes > 50 * MEBIBYTE
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

/** Resolves and validates non-frame video reference inputs. */
export async function resolveOpenRouterReferenceInputs(input: {
  profile: CatalogVideoRequestProfile
  referenceInputs: OrderedVideoMediaInput[]
  resolveAsset: OpenRouterAssetResolver
}) {
  const perSlotLimit = input.profile.referenceLimits.audio
    + input.profile.referenceLimits.image
    + input.profile.referenceLimits.video
  const totalLimit = input.profile.totalReferenceLimit ?? perSlotLimit
  if (input.referenceInputs.length < 1 || input.referenceInputs.length > totalLimit)
    throwProviderResponseInvalid()
  const profileLimit = {
    audioReferences: input.profile.referenceLimits.audio,
    imageReferences: input.profile.referenceLimits.image,
    videoReferences: input.profile.referenceLimits.video,
  } as const
  const slotCounts = new Map<string, number>()
  const references: OpenRouterVideoReference[] = []
  let audioDurationSeconds = 0
  let videoDurationSeconds = 0
  for (const item of input.referenceInputs) {
    const targetSlotId = item.targetSlotId as keyof typeof EXPECTED_MEDIA_TYPE
    const mediaType = EXPECTED_MEDIA_TYPE[targetSlotId]
    const nextCount = (slotCounts.get(item.targetSlotId) ?? 0) + 1
    if (
      !mediaType
      || item.asset.mediaType !== mediaType
      || nextCount > profileLimit[targetSlotId]
    ) {
      throwProviderResponseInvalid()
    }
    slotCounts.set(item.targetSlotId, nextCount)
    const resolved = await input.resolveAsset(item.asset)
    const durationSeconds = input.profile.referenceValidationPolicy
      === 'seedance-2-reference-v1'
      ? validateSeedanceReferenceAsset(mediaType, resolved)
      : 0
    if (mediaType === 'audio')
      audioDurationSeconds += durationSeconds
    if (mediaType === 'video')
      videoDurationSeconds += durationSeconds
    references.push(
      mediaType === 'image'
        ? { image_url: { url: resolved.providerUrl }, type: 'image_url' }
        : mediaType === 'video'
          ? { type: 'video_url', video_url: { url: resolved.providerUrl } }
          : { audio_url: { url: resolved.providerUrl }, type: 'audio_url' },
    )
  }
  if (!(slotCounts.get('imageReferences') || slotCounts.get('videoReferences')))
    throwProviderResponseInvalid()
  if (
    input.profile.referenceValidationPolicy === 'seedance-2-reference-v1'
    && (audioDurationSeconds > 15 || videoDurationSeconds > 15)
  ) {
    throwProviderResponseInvalid()
  }
  return {
    referenceCounts: {
      audio: slotCounts.get('audioReferences') ?? 0,
      image: slotCounts.get('imageReferences') ?? 0,
      video: slotCounts.get('videoReferences') ?? 0,
    },
    references,
  }
}
