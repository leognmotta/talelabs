import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import {
  isSystemAdminRole,
  requireOrganizationSession,
} from '@talelabs/auth'
import { requireAuth } from '../../middleware/auth.js'
import { ErrorResponseSchema } from '../../schemas/common.js'
import { MeResponseSchema } from './account.schemas.js'

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  operationId: 'getMe',
  tags: ['Account'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeResponseSchema,
        },
      },
      description: 'Authenticated user and active organization session',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Active organization required',
    },
  },
})

export function registerAccountRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(meRoute, async (c) => {
    requireAuth(c)

    const result = await requireOrganizationSession(c.req.raw.headers)

    if (!result.ok && result.status === 401)
      return c.json({ error: result.error }, 401)

    if (!result.ok)
      return c.json({ error: result.error }, 403)

    return c.json({
      activeOrganizationId: result.activeOrganizationId,
      isSystemAdmin: isSystemAdminRole(result.session.user.role),
      session: {
        id: result.session.session.id,
        createdAt: result.session.session.createdAt.toISOString(),
        expiresAt: result.session.session.expiresAt.toISOString(),
      },
      user: {
        id: result.session.user.id,
        email: result.session.user.email,
        name: result.session.user.name,
      },
    }, 200)
  })
}
