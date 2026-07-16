/** Speech request validation and preparation before provider submission. */

import type { NormalizedGenerationRequest } from '@talelabs/flows'
import type { createOpenRouterHttpClient } from '../../transport/client.js'
import type { OpenRouterSpeechBinding } from '../../types.js'
import type { OpenRouterImmediatePreparation } from '../immediate-adapter.js'

import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { createOpenRouterHttpClient as createClient } from '../../transport/client.js'
import { assertRequestMatchesBinding } from '../binding.js'
import { assertOnlySettings, requestText } from '../request.js'
import { createOpenRouterSpeechSubmission } from './execute.js'

function openRouterSpeechSettings(
  request: NormalizedGenerationRequest,
  binding: OpenRouterSpeechBinding,
) {
  assertOnlySettings(request, binding.requestProfile.settingIds)
  const voiceValue = request.settings.voice
  const outputFormat = request.settings.outputFormat
  const voice = typeof voiceValue === 'string'
    ? binding.requestProfile.voiceValues[voiceValue]
    : undefined
  if (
    !voice
    || typeof outputFormat !== 'string'
    || !binding.requestProfile.outputFormats.includes(outputFormat as 'mp3')
  ) {
    throwProviderResponseInvalid()
  }
  return { outputFormat: outputFormat as 'mp3', voice }
}

/** Prepares one speech call before the durable spend boundary is crossed. */
export function createOpenRouterSpeechPreparation(input: {
  binding: OpenRouterSpeechBinding
  client?: ReturnType<typeof createOpenRouterHttpClient>
}): OpenRouterImmediatePreparation {
  return async (request) => {
    try {
      assertRequestMatchesBinding(request, input.binding, 'speech')
      const settings = openRouterSpeechSettings(request, input.binding)
      return createOpenRouterSpeechSubmission({
        body: {
          input: requestText(request),
          model: input.binding.nativeModelId,
          response_format: settings.outputFormat,
          voice: settings.voice,
        },
        client: input.client ?? createClient(),
        endpoint: input.binding.endpoint,
      })
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
