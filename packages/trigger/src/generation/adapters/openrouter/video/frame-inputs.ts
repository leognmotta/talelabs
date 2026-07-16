import type { OpenRouterVideoRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type {
  OpenRouterFrameImage,
  OrderedVideoMediaInput,
} from './input-types.js'
import { throwProviderResponseInvalid } from '../../errors.js'

export async function resolveOpenRouterFrameInputs(input: {
  frameInputs: OrderedVideoMediaInput[]
  mediaInputCount: number
  profile: OpenRouterVideoRequestProfile
  resolveAsset: (
    asset: OrderedVideoMediaInput['asset'],
  ) => Promise<ResolvedGenerationAsset>
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
    ...(lastFrames.length
      ? [[lastFrames[0], 'last_frame'] as const]
      : []),
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
