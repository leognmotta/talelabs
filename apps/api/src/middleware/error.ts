/** Stable API error responses for expected domain and transport failures. */

import type { Context } from 'hono'

import { HTTPException } from 'hono/http-exception'

/** One field-scoped validation or domain failure returned to API clients. */
export interface ErrorDetail {
  /** Stable machine-readable failure code. */
  code: string
  /** Dot-delimited request field associated with the failure. */
  field: string
  /** Human-readable fallback when the client lacks a localized message. */
  message: string
  /** Structured values available to localized client messages. */
  params?: Record<string, boolean | number | string>
}

type ErrorStatusCode
  = | 400
    | 401
    | 402
    | 403
    | 404
    | 409
    | 422
    | 429
    | 500
    | 502

/** Expected API-domain failure with a stable status, code, and optional details. */
export class HttpError extends Error {
  constructor(
    /** HTTP status returned for this expected failure. */
    public readonly status: ErrorStatusCode,
    /** Stable machine-readable top-level failure code. */
    public readonly code: string,
    message: string,
    /** Optional field-scoped failures for client rendering. */
    public readonly details?: ErrorDetail[],
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/** Expected failure raised when a route requires an authenticated session. */
export class UnauthenticatedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, 'unauthenticated', message)
    this.name = 'UnauthenticatedError'
  }
}

/** Tenant-safe not-found failure that does not disclose cross-tenant existence. */
export class TenantResourceNotFoundError extends HttpError {
  constructor(field?: string) {
    super(
      404,
      'not_found',
      'Resource not found.',
      field
        ? [{
            code: 'not_found',
            field,
            message: 'The referenced resource was not found.',
          }]
        : undefined,
    )
    this.name = 'TenantResourceNotFoundError'
  }
}

/** Returns an authorized tenant resource or raises the tenant-safe 404 contract. */
export function requireTenantResource<Resource>(
  resource: null | Resource | undefined,
  field?: string,
): Resource {
  if (resource == null)
    throw new TenantResourceNotFoundError(field)

  return resource
}

/** Builds the shared JSON envelope for stable API error responses. */
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

/** Converts expected failures to responses and logs only unexpected server errors. */
export function errorHandler(error: Error, c: Context) {
  if (error instanceof HttpError)
    return c.json(apiError(error.code, error.message, error.details), error.status)

  if (
    error instanceof HTTPException
    && error.status === 400
    && error.message === 'Malformed JSON in request body'
  ) {
    return c.json(
      apiError('invalid_json', 'Malformed JSON in request body.'),
      400,
    )
  }

  if (error instanceof HTTPException)
    return error.getResponse()

  console.error(error)

  return c.json(apiError('internal_error', 'Internal server error'), 500)
}
