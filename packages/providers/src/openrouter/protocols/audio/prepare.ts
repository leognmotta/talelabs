/**
 * OpenRouter chat-audio request validation before provider submission.
 */

import type { OpenRouterHttpClient } from '../../transport/contracts.js'
import type { OpenRouterAudioBinding } from '../../types.js'
import type { OpenRouterImmediatePreparation } from '../immediate-adapter.js'

import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { assertRequestMatchesBinding, pinnedOpenRouterProvider } from '../binding.js'
import { assertOnlySettings, requestText } from '../request.js'
import { createOpenRouterAudioSubmission } from './execute.js'

/** Prepares one streaming audio call before the durable spend boundary. */
export function createOpenRouterAudioPreparation(input: {
  /** Exact reviewed audio binding captured in the run snapshot. */
  binding: OpenRouterAudioBinding
  /** Authenticated bounded OpenRouter client. */
  client: OpenRouterHttpClient
}): OpenRouterImmediatePreparation {
  return async (request) => {
    try {
      assertRequestMatchesBinding(request, input.binding, 'audio')
      assertOnlySettings(request, input.binding.requestProfile.settingIds)
      if (request.outputCount !== 1 || request.orderedInputs.length > 0)
        throwProviderResponseInvalid()
      return createOpenRouterAudioSubmission({
        body: {
          audio: { format: input.binding.requestProfile.outputFormat },
          messages: [{ content: requestText(request), role: 'user' }],
          modalities: ['text', 'audio'],
          model: input.binding.nativeModelId,
          provider: pinnedOpenRouterProvider(input.binding),
          stream: true,
          stream_options: { include_usage: true },
        },
        client: input.client,
        endpoint: input.binding.endpoint,
      })
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
