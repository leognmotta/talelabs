import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterHttpClient } from '@talelabs/openrouter'
import {
  generationProviderError,
  throwProviderResponseInvalid,
} from '../../errors.js'
import { isMp4 } from '../shared/media-signatures.js'
import { providerFacts } from '../shared/provider-facts.js'
import {
  openRouterVideoStatusSchema,
  optionalOpenRouterProviderId,
  optionalOpenRouterUsageCost,
} from './response.js'
import {
  OPENROUTER_MAX_VIDEO_BYTES,
  validatedOpenRouterVideoStream,
} from './stream.js'
import { logOpenRouterVideoHttpError } from './telemetry.js'

const VIDEO_CONTENT_TIMEOUT_MS = 10 * 60 * 1_000
const VIDEO_STATUS_TIMEOUT_MS = 30_000

export function createOpenRouterVideoPoll(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  delivery: 'bytes' | 'stream'
  route: Readonly<PinnedGenerationProviderRoute>
}) {
  return async (externalJobId: string) => {
    try {
      const encodedId = encodeURIComponent(externalJobId)
      const client = input.client ?? createOpenRouterHttpClient()
      const statusResponse = await client.requestJson({
        method: 'GET',
        path: `/api/v1/videos/${encodedId}`,
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
      const media = await (input.delivery === 'stream'
        ? client.requestStream({
            maxResponseBytes: OPENROUTER_MAX_VIDEO_BYTES,
            method: 'GET',
            path: `/api/v1/videos/${encodedId}/content?index=0`,
            timeoutMs: VIDEO_CONTENT_TIMEOUT_MS,
          })
        : client.requestBytes({
            maxResponseBytes: OPENROUTER_MAX_VIDEO_BYTES,
            method: 'GET',
            path: `/api/v1/videos/${encodedId}/content?index=0`,
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
      logOpenRouterVideoHttpError(error, 'poll')
      throw generationProviderError(error)
    }
  }
}
