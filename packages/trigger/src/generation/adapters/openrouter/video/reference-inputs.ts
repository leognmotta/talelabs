import type { GenerationModelDefinition } from '@talelabs/flows'

import type { OpenRouterVideoRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type {
  OpenRouterVideoReference,
  OrderedVideoMediaInput,
} from './input-types.js'
import { throwProviderResponseInvalid } from '../../errors.js'
import {
  validateSeedanceReferenceAsset,
  validateSeedanceReferenceDurations,
} from './seedance-validation.js'

const EXPECTED_MEDIA_TYPE = {
  audioReferences: 'audio',
  imageReferences: 'image',
  videoReferences: 'video',
} as const

export async function resolveOpenRouterReferenceInputs(input: {
  model: GenerationModelDefinition
  profile: OpenRouterVideoRequestProfile
  referenceInputs: OrderedVideoMediaInput[]
  referenceLimit: number
  resolveAsset: (
    asset: OrderedVideoMediaInput['asset'],
  ) => Promise<ResolvedGenerationAsset>
}) {
  if (
    input.referenceInputs.length < 1
    || input.referenceInputs.length > input.referenceLimit
  ) {
    throwProviderResponseInvalid()
  }
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
    const slot = input.model.inputSlots.find(
      candidate => candidate.id === item.targetSlotId,
    )
    const nextCount = (slotCounts.get(item.targetSlotId) ?? 0) + 1
    if (
      !mediaType
      || !slot
      || item.asset.mediaType !== mediaType
      || nextCount > slot.maxItems
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
        ? { image_url: { url: resolved.signedReadUrl }, type: 'image_url' }
        : mediaType === 'video'
          ? { type: 'video_url', video_url: { url: resolved.signedReadUrl } }
          : { audio_url: { url: resolved.signedReadUrl }, type: 'audio_url' },
    )
  }
  if (
    !(slotCounts.get('imageReferences') || slotCounts.get('videoReferences'))
  ) {
    throwProviderResponseInvalid()
  }
  if (input.profile.referenceValidationPolicy === 'seedance-2-reference-v1') {
    validateSeedanceReferenceDurations({
      audioDurationSeconds,
      videoDurationSeconds,
    })
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
