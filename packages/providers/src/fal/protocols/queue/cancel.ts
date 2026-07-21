/** Best-effort fal queue cancellation for one stable request ID. */

import type { FalHttpClient } from '../../transport/contracts.js'

import { generationProviderError } from '../../errors.js'
import { FalHttpError } from '../../transport/contracts.js'
import {
  falAlreadyCompletedSchema,
  falCancellationNotFoundSchema,
  falCancellationRequestedSchema,
} from './response.js'
import { falQueueRequestUrls } from './urls.js'

const FAL_CANCEL_TIMEOUT_MS = 30_000

function falCancellationErrorStatus(error: FalHttpError) {
  if (!error.providerMessage)
    return null
  try {
    const payload: unknown = JSON.parse(error.providerMessage)
    if (falAlreadyCompletedSchema.safeParse(payload).success)
      return 'already_completed' as const
    if (falCancellationNotFoundSchema.safeParse(payload).success)
      return 'not_found' as const
  }
  catch {
    return null
  }
  return null
}

/** Creates the normalized cancellation operation for one immutable fal route. */
export function createFalQueueCancel(input: {
  client: FalHttpClient
  nativeModelId: string
  queueOrigin: string
}) {
  return async (externalJobId: string) => {
    try {
      const urls = falQueueRequestUrls({
        nativeModelId: input.nativeModelId,
        queueOrigin: input.queueOrigin,
        requestId: externalJobId,
      })
      await input.client.requestJson({
        method: 'PUT',
        schema: falCancellationRequestedSchema,
        timeoutMs: FAL_CANCEL_TIMEOUT_MS,
        url: urls.cancel,
      })
      return { accepted: true, final: false }
    }
    catch (error) {
      if (error instanceof FalHttpError) {
        const status = falCancellationErrorStatus(error)
        if (
          (error.status === 400 && status === 'already_completed')
          || (error.status === 404 && status === 'not_found')
        ) {
          return { accepted: false, final: true }
        }
      }
      throw generationProviderError(error)
    }
  }
}
