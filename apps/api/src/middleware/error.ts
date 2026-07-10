import type { Context } from 'hono'

export interface ErrorDetail {
  field: string
  message: string
}

type ErrorStatusCode = 400 | 401 | 402 | 403 | 404 | 409 | 422 | 500 | 502

export class HttpError extends Error {
  constructor(
    public readonly status: ErrorStatusCode,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, 'unauthenticated', message)
    this.name = 'UnauthenticatedError'
  }
}

export function apiError(
  code: string,
  message: string,
  details?: ErrorDetail[],
) {
  return {
    error: {
      code,
      message,
      ...(details?.length ? { details } : {}),
    },
  }
}

export function errorHandler(error: Error, c: Context) {
  if (error instanceof HttpError)
    return c.json(apiError(error.code, error.message, error.details), error.status)

  console.error(error)

  return c.json(apiError('internal_error', 'Internal server error'), 500)
}
