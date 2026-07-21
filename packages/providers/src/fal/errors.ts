/** fal transport-failure mapping onto the shared provider error boundary. */

import type { GenerationProviderErrorCode } from '../generation-error.js'

import {
  GenerationProviderError,
  providerFailureSafeToResubmit,
} from '../generation-error.js'
import { FalHttpError } from './transport/contracts.js'

/** Maps any fal transport failure into the stable provider error contract. */
export function generationProviderError(error: unknown) {
  if (error instanceof GenerationProviderError)
    return error
  if (error instanceof FalHttpError) {
    const code: GenerationProviderErrorCode = error.code === 'authentication'
      ? 'provider_authentication'
      : error.code === 'insufficient_balance'
        ? 'provider_insufficient_balance'
        : error.code === 'rate_limited'
          ? 'provider_rate_limited'
          : error.code === 'timeout'
            ? 'provider_timeout'
            : error.code === 'malformed_response'
              || error.code === 'response_too_large'
              ? 'provider_response_invalid'
              : error.code === 'rejected'
                ? 'provider_rejected'
                : error.code === 'outage'
                  ? 'provider_unavailable'
                  : 'provider_response_invalid'
    return new GenerationProviderError({
      code,
      publicMessage: error.providerMessage,
      retryAfterMs: error.retryAfterMs,
      retryable: error.retryable,
      safeToResubmit: providerFailureSafeToResubmit(code),
    })
  }
  return new GenerationProviderError({
    code: 'provider_response_invalid',
    retryable: false,
  })
}
