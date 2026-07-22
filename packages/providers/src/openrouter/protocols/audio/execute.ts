/**
 * OpenRouter streaming-audio submission and result normalization.
 */

import type { OpenRouterHttpClient } from '../../transport/contracts.js'

import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { providerFacts } from '../../provider-facts.js'
import { isWav } from '../media-signatures.js'
import {
  decodeOpenRouterAudioSse,
  OPENROUTER_MAX_AUDIO_SSE_BYTES,
} from './sse.js'

const AUDIO_REQUEST_TIMEOUT_MS = 10 * 60 * 1_000

/** Creates the spend-boundary streaming-audio submission closure. */
export function createOpenRouterAudioSubmission(input: {
  /** Validated request body sent to the pinned chat-completions route. */
  body: unknown
  /** Authenticated bounded OpenRouter client. */
  client: OpenRouterHttpClient
  /** Reviewed endpoint path captured in the immutable binding. */
  endpoint: string
}) {
  return async () => {
    try {
      const response = await input.client.requestStream({
        body: input.body,
        maxResponseBytes: OPENROUTER_MAX_AUDIO_SSE_BYTES,
        method: 'POST',
        path: input.endpoint,
        timeoutMs: AUDIO_REQUEST_TIMEOUT_MS,
      })
      if (response.contentType !== 'text/event-stream')
        throwProviderResponseInvalid()
      const result = await decodeOpenRouterAudioSse(response.value)
      if (!isWav(result.bytes))
        throwProviderResponseInvalid()
      return {
        facts: providerFacts({
          generationId: result.generationId ?? response.generationId,
          providerCostUsd: result.providerCostUsd,
        }),
        outputs: [{
          mediaType: 'audio' as const,
          outputIndex: 0,
          payload: {
            bytes: result.bytes,
            delivery: 'bytes' as const,
            mimeType: 'audio/wav' as const,
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
