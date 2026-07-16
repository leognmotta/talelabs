import { OpenRouterHttpError } from '@talelabs/openrouter'
import { sanitizeProviderPublicMessage } from './public-message.js'

export { sanitizeProviderPublicMessage } from './public-message.js'

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

export function generationProviderError(error: unknown) {
  if (error instanceof GenerationProviderError)
    return error
  if (error instanceof OpenRouterHttpError) {
    let code: GenerationProviderErrorCode
    switch (error.code) {
      case 'authentication':
        code = 'provider_authentication'
        break
      case 'insufficient_balance':
        code = 'provider_insufficient_balance'
        break
      case 'rate_limited':
        code = 'provider_rate_limited'
        break
      case 'timeout':
        code = 'provider_timeout'
        break
      case 'malformed_response':
      case 'response_too_large':
        code = 'provider_response_invalid'
        break
      case 'rejected':
        code = 'provider_rejected'
        break
      case 'outage':
        code = 'provider_unavailable'
        break
      default:
        code = 'provider_response_invalid'
    }
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

export function throwProviderResponseInvalid(): never {
  throw new GenerationProviderError({
    code: 'provider_response_invalid',
    retryable: false,
  })
}
