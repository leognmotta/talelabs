/** fal transport status mapping, retry hints, and abort classification. */

import type { FalHttpErrorCode } from './contracts.js'

import { FalHttpError } from './contracts.js'

/** Parses a `Retry-After` header into milliseconds when present and bounded. */
export function falRetryAfterMs(header: null | string): null | number {
  if (!header)
    return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 3600)
    return Math.round(seconds * 1000)
  const dateMs = Date.parse(header)
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now()
    return delta > 0 ? Math.min(delta, 3_600_000) : 0
  }
  return null
}

/** Maps one non-OK HTTP status onto a typed, retry-classified fal error. */
export function falErrorForStatus(
  status: number,
  retryAfterMs: null | number,
  providerMessage: null | string,
): FalHttpError {
  let balanceLocked = false
  if (status === 403 && providerMessage) {
    try {
      const payload: unknown = JSON.parse(providerMessage)
      const detail
        = payload && typeof payload === 'object'
          ? (payload as { detail?: unknown }).detail
          : null
      if (typeof detail === 'string') {
        const normalizedDetail = detail.toLowerCase()
        balanceLocked
          = normalizedDetail.includes('locked')
            && normalizedDetail.includes('balance')
      }
    }
    catch {
      balanceLocked = false
    }
  }
  let code: FalHttpErrorCode = 'rejected'
  if (status === 401 || status === 403)
    code = 'authentication'
  if (status === 402 || balanceLocked)
    code = 'insufficient_balance'
  if (status === 429)
    code = 'rate_limited'
  if (status >= 500)
    code = 'outage'
  const retryable = code === 'rate_limited' || code === 'outage'
  return new FalHttpError({
    code,
    providerMessage,
    retryAfterMs,
    retryable,
    status,
  })
}

/** Classifies a thrown transport failure, distinguishing timeouts from outages. */
export function falTransportError(
  error: unknown,
  signal?: AbortSignal,
): FalHttpError {
  if (error instanceof FalHttpError)
    return error
  if (
    signal?.aborted
    || (error instanceof DOMException && error.name === 'AbortError')
  ) {
    return new FalHttpError({ code: 'timeout', retryable: true })
  }
  if (error instanceof DOMException && error.name === 'TimeoutError')
    return new FalHttpError({ code: 'timeout', retryable: true })
  return new FalHttpError({ code: 'outage', retryable: true })
}
