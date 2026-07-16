import type { NormalizedGenerationRequest } from '@talelabs/flows'

import type { OpenRouterSpeechRequestProfile } from '@talelabs/openrouter'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterHttpClient } from '@talelabs/openrouter'
import {
  generationProviderError,
  throwProviderResponseInvalid,
} from '../../errors.js'
import { isMp3 } from '../shared/media-signatures.js'
import { providerFacts } from '../shared/provider-facts.js'
import { requestText } from '../shared/request.js'
import { openRouterSpeechSettings } from './settings.js'

const MAX_SPEECH_BYTES = 32 * 1024 * 1024
const SPEECH_REQUEST_TIMEOUT_MS = 2 * 60 * 1_000

export function createOpenRouterSpeechPreparation(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterSpeechRequestProfile
  route: Readonly<PinnedGenerationProviderRoute>
}) {
  return async (request: NormalizedGenerationRequest) => {
    try {
      const settings = openRouterSpeechSettings(request, input.route, input.profile)
      const client = input.client ?? createOpenRouterHttpClient()
      const body = {
        input: requestText(request),
        model: input.route.providerModel,
        response_format: settings.outputFormat,
        voice: settings.voice,
      }
      return async () => {
        try {
          const response = await client.requestBytes({
            body,
            maxResponseBytes: MAX_SPEECH_BYTES,
            method: 'POST',
            path: '/api/v1/audio/speech',
            timeoutMs: SPEECH_REQUEST_TIMEOUT_MS,
          })
          if (
            response.contentType !== 'audio/mpeg'
            && response.contentType !== 'audio/mp3'
          ) {
            throwProviderResponseInvalid()
          }
          if (!isMp3(response.value))
            throwProviderResponseInvalid()
          return {
            facts: providerFacts({ generationId: response.generationId }),
            outputs: [{
              mediaType: 'audio' as const,
              outputIndex: 0,
              payload: {
                bytes: response.value,
                delivery: 'bytes' as const,
                mimeType: 'audio/mpeg' as const,
              },
            }],
            status: 'completed' as const,
          }
        }
        catch (error) {
          throw generationProviderError(error)
        }
      }
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
