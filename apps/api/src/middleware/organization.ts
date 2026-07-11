import type { ApiEnv } from '../types.js'

import { requireOrganizationSession } from '@talelabs/auth'
import { createMiddleware } from 'hono/factory'
import { HttpError, UnauthenticatedError } from './error.js'

export interface OrganizationSessionResolution {
  activeOrganizationId: string
  session: {
    user: {
      id: string
    }
  }
}

export type OrganizationSessionResolver = (
  headers: Headers,
) => Promise<
  | { error: string, ok: false, status: 401 | 403 }
  | ({ ok: true } & OrganizationSessionResolution)
>

const defaultOrganizationSessionResolver: OrganizationSessionResolver
  = async headers => requireOrganizationSession(headers)

export function createOrganizationMiddleware(
  resolveOrganizationSession: OrganizationSessionResolver
    = defaultOrganizationSessionResolver,
) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    const result = await resolveOrganizationSession(c.req.raw.headers)

    if (!result.ok && result.status === 401)
      throw new UnauthenticatedError(result.error)

    if (!result.ok) {
      throw new HttpError(
        403,
        'active_organization_required',
        result.error,
      )
    }

    const expectedOrganizationId = c.req.header('X-TaleLabs-Organization-Id')
    if (
      expectedOrganizationId
      && expectedOrganizationId !== result.activeOrganizationId
    ) {
      throw new HttpError(
        409,
        'organization_context_changed',
        'The active organization changed while this request was in progress.',
      )
    }

    c.set('organizationId', result.activeOrganizationId)
    c.set('userId', result.session.user.id)

    await next()
  })
}
