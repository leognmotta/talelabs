/** fal queue status polling, result reading, and output stream delivery. */

import type {
  NormalizedGenerationOutput,
  NormalizedGenerationPollResult,
} from '@talelabs/flows'
import type { FalHttpClient } from '../../transport/contracts.js'

import { throwProviderResponseInvalid } from '../../../generation-error.js'
import { generationProviderError } from '../../errors.js'
import {
  extractFalMediaOutputs,
  falMediaChunks,
  falResultSchema,
  falStatusSchema,
} from './response.js'
import { falQueueRequestUrls } from './urls.js'

const FAL_STATUS_TIMEOUT_MS = 30_000
const FAL_RESULT_TIMEOUT_MS = 30_000
const FAL_MEDIA_TIMEOUT_MS = 10 * 60 * 1_000
const FAL_DEFAULT_POLL_MS = 5_000
const FAL_RETRYABLE_ERROR_TYPES = new Set([
  'internal_error',
  'request_timeout',
  'runner_connection_error',
  'runner_connection_refused',
  'runner_connection_timeout',
  'runner_disconnected',
  'runner_incomplete_response',
  'runner_scheduling_failure',
  'runner_server_error',
  'startup_timeout',
])
const FAL_TIMEOUT_ERROR_TYPES = new Set([
  'request_timeout',
  'startup_timeout',
])

/** Default output MIME used when a fal result omits a content type. */
function defaultFalMime(mediaType: 'audio' | 'image' | 'video') {
  return mediaType === 'video'
    ? 'video/mp4'
    : mediaType === 'audio'
      ? 'audio/mpeg'
      : 'image/jpeg'
}

function falTerminalFailure(errorType: string | undefined) {
  const normalizedType = errorType?.trim().toLowerCase()
  const retryable = normalizedType !== undefined
    && FAL_RETRYABLE_ERROR_TYPES.has(normalizedType)
  return {
    code: normalizedType && FAL_TIMEOUT_ERROR_TYPES.has(normalizedType)
      ? 'provider_timeout'
      : retryable
        ? 'provider_unavailable'
        : 'provider_rejected',
    message: normalizedType ?? 'provider_rejected',
    retryable,
    status: 'failed' as const,
  }
}

/**
 * Creates the status-and-result poller for one immutable fal binding. The
 * external job id is fal's stable request ID; queue paths are derived from the
 * captured native model so retries never depend on mutable convenience URLs.
 */
export function createFalQueuePoll(input: {
  client: FalHttpClient
  mediaType: 'audio' | 'image' | 'video'
  nativeModelId: string
  queueOrigin: string
}) {
  return async (externalJobId: string): Promise<NormalizedGenerationPollResult> => {
    try {
      const urls = falQueueRequestUrls({
        nativeModelId: input.nativeModelId,
        queueOrigin: input.queueOrigin,
        requestId: externalJobId,
      })
      const statusResponse = await input.client.requestJson({
        method: 'GET',
        schema: falStatusSchema,
        timeoutMs: FAL_STATUS_TIMEOUT_MS,
        url: urls.status,
      })
      const status = statusResponse.value.status.toUpperCase()
      if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
        return {
          pollAfterMs: statusResponse.retryAfterMs ?? FAL_DEFAULT_POLL_MS,
          status: 'pending',
        }
      }
      if (status !== 'COMPLETED') {
        return {
          code: 'provider_rejected',
          message: 'provider_rejected',
          retryable: false,
          status: 'failed',
        }
      }
      if (statusResponse.value.error || statusResponse.value.error_type)
        return falTerminalFailure(statusResponse.value.error_type)
      const resultResponse = await input.client.requestJson({
        method: 'GET',
        schema: falResultSchema,
        timeoutMs: FAL_RESULT_TIMEOUT_MS,
        url: urls.result,
      })
      const media = extractFalMediaOutputs(resultResponse.value, input.mediaType)
      if (!media.length)
        throwProviderResponseInvalid()
      const outputs: NormalizedGenerationOutput[] = []
      for (let index = 0; index < media.length; index += 1) {
        const item = media[index]!
        const stream = await input.client.requestMediaStream({
          timeoutMs: FAL_MEDIA_TIMEOUT_MS,
          url: item.url,
        })
        outputs.push({
          mediaType: input.mediaType,
          outputIndex: index,
          payload: {
            chunks: falMediaChunks(stream.value),
            delivery: 'stream',
            mimeType: item.mimeType ?? stream.contentType ?? defaultFalMime(input.mediaType),
          },
        })
      }
      return { outputs, status: 'completed' }
    }
    catch (error) {
      throw generationProviderError(error)
    }
  }
}
