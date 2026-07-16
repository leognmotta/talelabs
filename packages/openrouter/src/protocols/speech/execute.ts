/** Speech provider execution and byte-response normalization. */

import type { createOpenRouterHttpClient } from '../../transport/client.js'

import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { providerFacts } from '../../provider-facts.js'
import { isMp3 } from '../media-signatures.js'

const MAX_SPEECH_BYTES = 32 * 1024 * 1024
const SPEECH_REQUEST_TIMEOUT_MS = 2 * 60 * 1_000

/** Creates the spend-boundary speech submission closure. */
export function createOpenRouterSpeechSubmission(input: {
  body: unknown
  client: ReturnType<typeof createOpenRouterHttpClient>
  endpoint: string
}) {
  return async () => {
    try {
      const response = await input.client.requestBytes({
        body: input.body,
        maxResponseBytes: MAX_SPEECH_BYTES,
        method: 'POST',
        path: input.endpoint,
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
