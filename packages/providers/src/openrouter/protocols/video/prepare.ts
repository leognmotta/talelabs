/** Video request validation and preparation before provider submission. */

import type {
  NormalizedGenerationRequest,
  NormalizedGenerationSubmissionContext,
} from '@talelabs/flows'
import type { OpenRouterHttpClient } from '../../transport/contracts.js'
import type {
  OpenRouterAssetResolver,
  OpenRouterVideoBinding,
} from '../../types.js'

import { generationProviderError } from '../../errors.js'
import { assertRequestMatchesBinding, pinnedOpenRouterProvider } from '../binding.js'
import { requestText } from '../request.js'
import { createOpenRouterVideoSubmission } from './execute.js'
import { resolveOpenRouterVideoInputs } from './inputs.js'
import { openRouterVideoSettings } from './settings.js'

/** Prepares one video submission before the durable spend boundary is crossed. */
export function createOpenRouterVideoPreparation(input: {
  binding: OpenRouterVideoBinding
  client: OpenRouterHttpClient
  resolveAsset: OpenRouterAssetResolver
}) {
  return async (
    request: NormalizedGenerationRequest,
    context?: NormalizedGenerationSubmissionContext,
  ) => {
    try {
      assertRequestMatchesBinding(request, input.binding, 'video')
      const settings = openRouterVideoSettings(request, input.binding)
      const videoInputs = await resolveOpenRouterVideoInputs({
        binding: input.binding,
        request,
        resolveAsset: input.resolveAsset,
      })
      return createOpenRouterVideoSubmission({
        body: {
          aspect_ratio: settings.aspectRatio,
          ...(context?.callbackUrl ? { callback_url: context.callbackUrl } : {}),
          duration: settings.duration,
          ...(videoInputs.frameImages.length
            ? { frame_images: videoInputs.frameImages }
            : {}),
          ...(settings.generateAudio === undefined
            ? {}
            : { generate_audio: settings.generateAudio }),
          ...(videoInputs.inputReferences.length
            ? { input_references: videoInputs.inputReferences }
            : {}),
          model: input.binding.nativeModelId,
          prompt: requestText(request),
          provider: pinnedOpenRouterProvider(input.binding),
          resolution: settings.resolution,
        },
        callbackExpected: Boolean(context?.callbackUrl),
        client: input.client,
        endpoint: input.binding.endpoint,
      })
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
