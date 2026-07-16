/**
 * Stable provider error contract and OpenRouter transport mapping.
 *
 */

import { sanitizeProviderPublicMessage } from './public-message.js'
import { OpenRouterHttpError } from './transport/contracts.js'

export { sanitizeProviderPublicMessage } from './public-message.js'

/** Stable error codes understood by the durable generation worker. */
export type GenerationProviderErrorCode
  = | 'provider_authentication'
    | 'provider_insufficient_balance'
    | 'provider_rate_limited'
    | 'provider_rejected'
    | 'provider_response_invalid'
    | 'provider_submission_uncertain'
    | 'provider_timeout'
    | 'provider_unavailable'

const PROVIDER_ERROR_MESSAGE_SEPARATOR = '\n'

/** Error safe for retry policy and persisted public failure projection. */
export class GenerationProviderError extends Error {
  readonly code: GenerationProviderErrorCode
  readonly publicMessage: null | string
  readonly retryAfterMs: null | number
  readonly retryable: boolean
  readonly safeToResubmit: boolean

  constructor(input: {
    code: GenerationProviderErrorCode
    publicMessage?: null | string
    retryAfterMs?: null | number
    retryable: boolean
    safeToResubmit?: boolean
  }) {
    const publicMessage = sanitizeProviderPublicMessage(input.publicMessage)
    super(publicMessage
      ? `${input.code}${PROVIDER_ERROR_MESSAGE_SEPARATOR}${publicMessage}`
      : input.code)
    this.code = input.code
    this.name = 'GenerationProviderError'
    this.publicMessage = publicMessage === input.code ? null : publicMessage
    this.retryAfterMs = input.retryAfterMs ?? null
    this.retryable = input.retryable
    this.safeToResubmit = input.safeToResubmit ?? false
  }
}

/** Maps any OpenRouter transport failure into the stable provider contract. */
export function generationProviderError(error: unknown) {
  if (error instanceof GenerationProviderError)
    return error
  if (error instanceof OpenRouterHttpError) {
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
      safeToResubmit: error.code === 'rate_limited',
    })
  }
  return new GenerationProviderError({
    code: 'provider_response_invalid',
    retryable: false,
  })
}

/** Throws one non-retryable invalid-response error. */
export function throwProviderResponseInvalid(): never {
  throw new GenerationProviderError({
    code: 'provider_response_invalid',
    retryable: false,
  })
}
