import { sanitizeProviderPublicMessage } from '../../generation/adapters/errors.js'

export type GenerationProviderFailureCode
  = | 'provider_authentication'
    | 'provider_insufficient_balance'
    | 'provider_rate_limited'
    | 'provider_rejected'
    | 'provider_response_invalid'
    | 'provider_submission_uncertain'
    | 'provider_timeout'
    | 'provider_unavailable'

const GENERATION_PROVIDER_FAILURE_CODES = new Set<GenerationProviderFailureCode>([
  'provider_authentication',
  'provider_insufficient_balance',
  'provider_rate_limited',
  'provider_rejected',
  'provider_response_invalid',
  'provider_submission_uncertain',
  'provider_timeout',
  'provider_unavailable',
])

export function isGenerationProviderFailureCode(
  value: string,
): value is GenerationProviderFailureCode {
  return GENERATION_PROVIDER_FAILURE_CODES.has(
    value as GenerationProviderFailureCode,
  )
}

export function serializedErrorProperty(
  error: unknown,
  property: 'message' | 'name' | 'publicMessage',
) {
  if (!error || typeof error !== 'object')
    return null
  const record = error as Record<string, unknown>
  return typeof record[property] === 'string' ? record[property] : null
}

export function serializedProviderFailure(error: unknown) {
  if (serializedErrorProperty(error, 'name') !== 'GenerationProviderError')
    return null
  const message = serializedErrorProperty(error, 'message')
  if (!message)
    return null
  const separator = message.indexOf('\n')
  const code = separator < 0 ? message : message.slice(0, separator)
  if (!isGenerationProviderFailureCode(code))
    return null
  return {
    code,
    publicMessage: separator < 0
      ? null
      : sanitizeProviderPublicMessage(message.slice(separator + 1)),
  }
}
