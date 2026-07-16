/** Video status polling, content delivery, and terminal response normalization. */

import type { createOpenRouterHttpClient } from '../../transport/client.js'
import type { OpenRouterVideoBinding } from '../../types.js'

import { generationProviderError, throwProviderResponseInvalid } from '../../errors.js'
import { providerFacts } from '../../provider-facts.js'
import { createOpenRouterHttpClient as createClient } from '../../transport/client.js'
import { isMp4 } from '../media-signatures.js'
import {
  OPENROUTER_MAX_VIDEO_BYTES,
  validatedOpenRouterVideoStream,
} from './media.js'
import {
  openRouterVideoStatusSchema,
  optionalOpenRouterProviderId,
  optionalOpenRouterUsageCost,
} from './response.js'

const VIDEO_CONTENT_TIMEOUT_MS = 10 * 60 * 1_000
const VIDEO_STATUS_TIMEOUT_MS = 30_000

/** Creates the status and content poller for one immutable video binding. */
export function createOpenRouterVideoPoll(input: {
  binding: OpenRouterVideoBinding
  client?: ReturnType<typeof createOpenRouterHttpClient>
  delivery: 'bytes' | 'stream'
}) {
  return async (externalJobId: string) => {
    try {
      const encodedId = encodeURIComponent(externalJobId)
      const client = input.client ?? createClient()
      const statusResponse = await client.requestJson({
        method: 'GET',
        path: `${input.binding.endpoint}/${encodedId}`,
        schema: openRouterVideoStatusSchema,
        timeoutMs: VIDEO_STATUS_TIMEOUT_MS,
      })
      const status = statusResponse.value.status.toLowerCase()
      const facts = providerFacts({
        generationId:
          optionalOpenRouterProviderId(statusResponse.value.generation_id)
          ?? statusResponse.generationId,
        providerCostUsd: optionalOpenRouterUsageCost(statusResponse.value.usage),
      })
      if (status === 'pending' || status === 'queued' || status === 'in_progress') {
        return {
          facts,
          pollAfterMs: statusResponse.retryAfterMs ?? 30_000,
          status: 'pending' as const,
        }
      }
      if (status !== 'completed') {
        return {
          code: 'provider_rejected' as const,
          facts,
          message: 'provider_rejected',
          retryable: false,
          status: 'failed' as const,
        }
      }
      const contentPath = `${input.binding.endpoint}/${encodedId}/content?index=0`
      const media = await (input.delivery === 'stream'
        ? client.requestStream({
            maxResponseBytes: OPENROUTER_MAX_VIDEO_BYTES,
            method: 'GET',
            path: contentPath,
            timeoutMs: VIDEO_CONTENT_TIMEOUT_MS,
          })
        : client.requestBytes({
            maxResponseBytes: OPENROUTER_MAX_VIDEO_BYTES,
            method: 'GET',
            path: contentPath,
            timeoutMs: VIDEO_CONTENT_TIMEOUT_MS,
          }))
      if (media.contentType !== 'video/mp4') {
        if (media.value instanceof ReadableStream)
          await media.value.cancel()
        throwProviderResponseInvalid()
      }
      if (input.delivery === 'stream') {
        if (!(media.value instanceof ReadableStream))
          throwProviderResponseInvalid()
        return {
          facts,
          outputs: [{
            mediaType: 'video' as const,
            outputIndex: 0,
            payload: {
              chunks: validatedOpenRouterVideoStream(media.value),
              delivery: 'stream' as const,
              mimeType: 'video/mp4' as const,
            },
          }],
          status: 'completed' as const,
        }
      }
      if (!(media.value instanceof Uint8Array) || !isMp4(media.value))
        throwProviderResponseInvalid()
      return {
        facts,
        outputs: [{
          mediaType: 'video' as const,
          outputIndex: 0,
          payload: {
            bytes: media.value,
            delivery: 'bytes' as const,
            mimeType: 'video/mp4' as const,
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
