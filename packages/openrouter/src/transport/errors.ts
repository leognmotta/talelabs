import { OpenRouterHttpError } from './contracts.js'

export function openRouterRetryAfterMs(value: null | string) {
  if (!value)
    return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(Math.ceil(seconds * 1_000), 15 * 60 * 1_000)
  const date = Date.parse(value)
  if (!Number.isFinite(date))
    return null
  return Math.min(Math.max(0, date - Date.now()), 15 * 60 * 1_000)
}

export function openRouterErrorForStatus(
  status: number,
  retryAfter: null | number,
  providerError?: { code: null | string, message: null | string },
) {
  const providerFacts = {
    providerCode: providerError?.code,
    providerMessage: providerError?.message,
  }
  if (status === 401 || status === 403) {
    return new OpenRouterHttpError({
      code: 'authentication',
      ...providerFacts,
      retryable: false,
      status,
    })
  }
  if (status === 402) {
    return new OpenRouterHttpError({
      code: 'insufficient_balance',
      ...providerFacts,
      retryable: false,
      status,
    })
  }
  if (status === 408 || status === 504) {
    return new OpenRouterHttpError({
      code: 'timeout',
      ...providerFacts,
      retryAfterMs: retryAfter,
      retryable: true,
      status,
    })
  }
  if (status === 429) {
    return new OpenRouterHttpError({
      code: 'rate_limited',
      ...providerFacts,
      retryAfterMs: retryAfter,
      retryable: true,
      status,
    })
  }
  if (status >= 500) {
    return new OpenRouterHttpError({
      code: 'outage',
      ...providerFacts,
      retryAfterMs: retryAfter,
      retryable: true,
      status,
    })
  }
  return new OpenRouterHttpError({
    code: 'rejected',
    ...providerFacts,
    retryable: false,
    status,
  })
}

export function openRouterTransportError(error: unknown, signal?: AbortSignal) {
  if (error instanceof OpenRouterHttpError)
    return error
  if (
    signal?.aborted
    || (error instanceof DOMException
      && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  ) {
    return new OpenRouterHttpError({ code: 'timeout', retryable: true })
  }
  return new OpenRouterHttpError({ code: 'outage', retryable: true })
}
