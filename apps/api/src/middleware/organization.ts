import type { Context } from 'hono'
import type { ApiEnv } from '../types.js'

import { requireOrganizationSession } from '@talelabs/auth'
import { createMiddleware } from 'hono/factory'
import { HttpError, UnauthenticatedError } from './error.js'

export const organizationMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const result = await requireOrganizationSession(c.req.raw.headers)

  if (!result.ok && result.status === 401)
    throw new UnauthenticatedError(result.error)

  if (!result.ok) {
    throw new HttpError(
      403,
      'active_organization_required',
      result.error,
    )
  }

  c.set('organizationId', result.activeOrganizationId)
  c.set('userId', result.session.user.id)

  await next()
})

export function requireOrganization(c: Context<ApiEnv>) {
  return {
    organizationId: c.var.organizationId,
    userId: c.var.userId,
  }
}
