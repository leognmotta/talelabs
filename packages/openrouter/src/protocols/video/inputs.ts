/**
 * Ordered input resolution for the OpenRouter video protocol.
 *
 */

import type { NormalizedGenerationRequest } from '@talelabs/flows'
import type { OpenRouterAssetResolver, OpenRouterVideoBinding } from '../../types.js'
import type {
  OpenRouterFrameImage,
  OpenRouterVideoInputs,
  OrderedVideoMediaInput,
} from './types.js'

import { throwProviderResponseInvalid } from '../../errors.js'
import { resolveOpenRouterReferenceInputs } from './references.js'

function orderedMediaInputs(request: NormalizedGenerationRequest) {
  return request.orderedInputs
    .toSorted((left, right) => left.order - right.order)
    .flatMap(item => item.items.flatMap(runtimeItem =>
      [...runtimeItem.assets]
        .toSorted((left, right) => left.order - right.order)
        .map(asset => ({ asset, targetSlotId: item.targetSlotId })),
    ))
}

async function resolveFrameInputs(input: {
  frameInputs: OrderedVideoMediaInput[]
  mediaInputCount: number
  profile: OpenRouterVideoBinding['requestProfile']
  resolveAsset: OpenRouterAssetResolver
}) {
  if (input.mediaInputCount !== input.frameInputs.length)
    throwProviderResponseInvalid()
  const firstFrames = input.frameInputs.filter(
    item => item.targetSlotId === 'firstFrame',
  )
  const lastFrames = input.frameInputs.filter(
    item => item.targetSlotId === 'lastFrame',
  )
  if (
    firstFrames.length !== 1
    || (input.profile.frameMode === 'first' && lastFrames.length !== 0)
    || (input.profile.frameMode === 'first-last' && lastFrames.length > 1)
  ) {
    throwProviderResponseInvalid()
  }
  const frameImages: OpenRouterFrameImage[] = []
  for (const [item, frameType] of [
    [firstFrames[0], 'first_frame'],
    ...(lastFrames.length ? [[lastFrames[0], 'last_frame'] as const] : []),
  ] as const) {
    if (item?.asset.mediaType !== 'image')
      throwProviderResponseInvalid()
    const resolved = await input.resolveAsset(item.asset)
    frameImages.push({
      frame_type: frameType,
      image_url: { url: resolved.signedReadUrl },
      type: 'image_url',
    })
  }
  return frameImages
}

/** Resolves frame or multi-media references from the immutable request. */
export async function resolveOpenRouterVideoInputs(input: {
  binding: OpenRouterVideoBinding
  request: NormalizedGenerationRequest
  resolveAsset: OpenRouterAssetResolver
}): Promise<OpenRouterVideoInputs> {
  const mediaInputs = orderedMediaInputs(input.request)
  const frameInputs = mediaInputs.filter(item =>
    item.targetSlotId === 'firstFrame' || item.targetSlotId === 'lastFrame',
  )
  const referenceInputs = mediaInputs.filter(item =>
    item.targetSlotId === 'imageReferences'
    || item.targetSlotId === 'videoReferences'
    || item.targetSlotId === 'audioReferences',
  )
  const profile = input.binding.requestProfile
  if (profile.frameMode === 'none' && input.request.operationId === 'textToVideo') {
    if (mediaInputs.length)
      throwProviderResponseInvalid()
    return {
      frameImages: [],
      inputReferences: [],
      referenceCounts: { audio: 0, image: 0, video: 0 },
    }
  }
  if (profile.frameMode !== 'none') {
    return {
      frameImages: await resolveFrameInputs({
        frameInputs,
        mediaInputCount: mediaInputs.length,
        profile,
        resolveAsset: input.resolveAsset,
      }),
      inputReferences: [],
      referenceCounts: { audio: 0, image: 0, video: 0 },
    }
  }
  if (
    input.request.operationId !== 'referencesToVideo'
    || mediaInputs.length !== referenceInputs.length
  ) {
    throwProviderResponseInvalid()
  }
  const resolved = await resolveOpenRouterReferenceInputs({
    profile,
    referenceInputs,
    resolveAsset: input.resolveAsset,
  })
  return {
    frameImages: [],
    inputReferences: resolved.references,
    referenceCounts: resolved.referenceCounts,
  }
}
