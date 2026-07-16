import type {
  GenerationModelDefinition,
  GenerationOperationDefinition,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import type { OpenRouterVideoRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type { OpenRouterVideoInputs } from './input-types.js'
import { throwProviderResponseInvalid } from '../../errors.js'
import { resolveOpenRouterFrameInputs } from './frame-inputs.js'
import { resolveOpenRouterReferenceInputs } from './reference-inputs.js'

function orderedMediaInputs(request: NormalizedGenerationRequest) {
  return request.orderedInputs
    .toSorted((left, right) => left.order - right.order)
    .flatMap(item =>
      item.items.flatMap(runtimeItem =>
        [...runtimeItem.assets]
          .toSorted((left, right) => left.order - right.order)
          .map(asset => ({ asset, targetSlotId: item.targetSlotId })),
      ),
    )
}

export async function resolveOpenRouterVideoInputs(input: {
  model: GenerationModelDefinition
  operation: GenerationOperationDefinition
  profile: OpenRouterVideoRequestProfile
  request: NormalizedGenerationRequest
  resolveAsset: (
    asset: ReturnType<typeof orderedMediaInputs>[number]['asset'],
  ) => Promise<ResolvedGenerationAsset>
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
  if (input.profile.frameMode === 'none' && input.request.operationId === 'textToVideo') {
    if (mediaInputs.length)
      throwProviderResponseInvalid()
    return {
      frameImages: [],
      inputReferences: [],
      referenceCounts: { audio: 0, image: 0, video: 0 },
    }
  }
  if (input.profile.frameMode !== 'none') {
    return {
      frameImages: await resolveOpenRouterFrameInputs({
        frameInputs,
        mediaInputCount: mediaInputs.length,
        profile: input.profile,
        resolveAsset: input.resolveAsset,
      }),
      inputReferences: [],
      referenceCounts: { audio: 0, image: 0, video: 0 },
    }
  }
  if (
    input.request.operationId !== 'referencesToVideo'
    || !input.operation.referenceLimit
    || mediaInputs.length !== referenceInputs.length
  ) {
    throwProviderResponseInvalid()
  }
  const resolved = await resolveOpenRouterReferenceInputs({
    model: input.model,
    profile: input.profile,
    referenceInputs,
    referenceLimit: input.operation.referenceLimit.maxItems,
    resolveAsset: input.resolveAsset,
  })
  return {
    frameImages: [],
    inputReferences: resolved.references,
    referenceCounts: resolved.referenceCounts,
  }
}
