/** Assembles the asynchronous fal queue adapter from one captured binding. */

import type {
  NormalizedGenerationProviderAdapter,
  NormalizedGenerationRequest,
  NormalizedGenerationSubmissionContext,
} from '@talelabs/flows'
import type { FalHttpClient } from '../../transport/contracts.js'
import type { FalAssetResolver, FalQueueBinding } from '../../types.js'

import { throwProviderResponseInvalid } from '../../../generation-error.js'
import { generationProviderError } from '../../errors.js'
import { createFalQueueCancel } from './cancel.js'
import { createFalQueuePoll } from './poll.js'
import { buildFalRequestBody } from './request.js'
import { falSubmitSchema } from './response.js'

const FAL_SUBMISSION_TIMEOUT_MS = 60_000
const FAL_DEFAULT_POLL_MS = 5_000

/** Maps the request-profile kind onto the normalized output media type. */
function outputMediaType(binding: FalQueueBinding) {
  return binding.requestProfile.kind === 'image'
    ? 'image' as const
    : binding.requestProfile.kind === 'video'
      ? 'video' as const
      : 'audio' as const
}

/** Creates the shared asynchronous fal queue protocol adapter. */
export function createFalQueueAdapter(input: {
  binding: FalQueueBinding
  client: FalHttpClient
  queueOrigin: string
  resolveAsset: FalAssetResolver
}): NormalizedGenerationProviderAdapter {
  const submitUrl = `${input.queueOrigin}/${input.binding.nativeModelId}`
  const prepare = async (
    request: NormalizedGenerationRequest,
    _context?: NormalizedGenerationSubmissionContext,
  ) => {
    try {
      if (request.operationId !== input.binding.operationId)
        throwProviderResponseInvalid()
      const body = await buildFalRequestBody({
        binding: input.binding,
        request,
        resolveAsset: input.resolveAsset,
      })
      return async () => {
        try {
          const response = await input.client.requestJson({
            body,
            method: 'POST',
            schema: falSubmitSchema,
            timeoutMs: FAL_SUBMISSION_TIMEOUT_MS,
            url: submitUrl,
          })
          return {
            externalJobId: response.value.request_id,
            facts: { providerGenerationId: response.value.request_id.slice(0, 512) },
            pollAfterMs: response.retryAfterMs ?? FAL_DEFAULT_POLL_MS,
            status: 'submitted' as const,
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
  return {
    cancel: createFalQueueCancel({
      client: input.client,
      nativeModelId: input.binding.nativeModelId,
      queueOrigin: input.queueOrigin,
    }),
    lifecycle: {
      cancellation: 'best-effort',
      completions: ['poll'],
      deliveries: ['stream'],
      submission: 'asynchronous',
    },
    poll: createFalQueuePoll({
      client: input.client,
      mediaType: outputMediaType(input.binding),
      nativeModelId: input.binding.nativeModelId,
      queueOrigin: input.queueOrigin,
    }),
    prepare,
    submit: async (request, context) => {
      const submit = await prepare(request, context)
      return submit()
    },
  }
}
