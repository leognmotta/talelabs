import type { Context } from 'hono'
import type { ApiEnv } from '../types.js'

import { auth } from '@talelabs/auth'
import { createMiddleware } from 'hono/factory'
import { UnauthenticatedError } from './error.js'

export const authMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  c.set('authSession', session)

  await next()
})

export function requireAuth(c: Context<ApiEnv>) {
  const session = c.var.authSession

  if (!session)
    throw new UnauthenticatedError()

  return session
}

export const requireAuthMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  requireAuth(c)

  await next()
})
