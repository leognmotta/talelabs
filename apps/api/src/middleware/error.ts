import type { Context } from 'hono'

type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 500 | 502

export class HttpError extends Error {
  constructor(
    public readonly status: ErrorStatusCode,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, message)
    this.name = 'UnauthenticatedError'
  }
}

export function errorHandler(error: Error, c: Context) {
  if (error instanceof HttpError)
    return c.json({ error: error.message }, error.status)

  console.error(error)

  return c.json({ error: 'Internal server error' }, 500)
}
