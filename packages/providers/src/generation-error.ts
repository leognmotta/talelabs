/**
 * Provider-neutral normalized error boundary shared by every provider adapter.
 *
 * The stable code set and `GenerationProviderError` class are the only failure
 * shape durable orchestration understands. Each provider owns the mapping from
 * its transport failures into this contract; the class and codes are shared so
 * retry policy, resubmission safety, and public-message projection behave
 * identically across providers.
 */

import { sanitizeProviderPublicMessage } from './public-message.js'

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

const DEFINITIVE_SUBMISSION_REJECTION_CODES
  = new Set<GenerationProviderErrorCode>([
    'provider_authentication',
    'provider_insufficient_balance',
    'provider_rate_limited',
    'provider_rejected',
  ])

/** Whether a provider response proves repeating submission cannot duplicate work. */
export function providerFailureSafeToResubmit(
  code: GenerationProviderErrorCode,
): boolean {
  return DEFINITIVE_SUBMISSION_REJECTION_CODES.has(code)
}

const PROVIDER_ERROR_MESSAGE_SEPARATOR = '\n'

/** Error safe for retry policy and persisted public failure projection. */
export class GenerationProviderError extends Error {
  /** Stable normalized provider failure code. */
  readonly code: GenerationProviderErrorCode
  /** Sanitized provider detail safe for persisted user-facing projection. */
  readonly publicMessage: null | string
  /** Bounded provider-requested retry delay, in milliseconds. */
  readonly retryAfterMs: null | number
  /** Whether durable execution may retry this operation. */
  readonly retryable: boolean
  /** Whether a retry may safely repeat the provider submission itself. */
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

/** Throws one non-retryable invalid-response error. */
export function throwProviderResponseInvalid(): never {
  throw new GenerationProviderError({
    code: 'provider_response_invalid',
    retryable: false,
  })
}
