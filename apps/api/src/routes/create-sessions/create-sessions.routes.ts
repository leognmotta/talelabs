/** Hono/OpenAPI routes for owned lightweight Create sessions. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'

import {
  deleteCreateSession,
  getCreateSession,
  listCreateSessions,
  renameCreateSession,
} from '../../services/create-sessions.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateSessionListQuerySchema,
  CreateSessionListResponseSchema,
  CreateSessionParamsSchema,
  CreateSessionSchema,
  RenameCreateSessionRequestSchema,
} from './create-sessions.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/create-sessions',
  tags: ['Create Sessions'],
  request: { query: CreateSessionListQuerySchema },
  responses: {
    200: {
      description: 'Owned Create sessions',
      content: {
        'application/json': { schema: CreateSessionListResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/create-sessions/{id}',
  tags: ['Create Sessions'],
  request: { params: CreateSessionParamsSchema },
  responses: {
    200: {
      description: 'Create session',
      content: { 'application/json': { schema: CreateSessionSchema } },
    },
    ...commonErrorResponses,
  },
})

const renameRoute = createRoute({
  method: 'patch',
  path: '/create-sessions/{id}',
  tags: ['Create Sessions'],
  request: {
    params: CreateSessionParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: RenameCreateSessionRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Renamed Create session',
      content: { 'application/json': { schema: CreateSessionSchema } },
    },
    ...commonErrorResponses,
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/create-sessions/{id}',
  tags: ['Create Sessions'],
  request: { params: CreateSessionParamsSchema },
  responses: {
    204: {
      description: 'Session hidden; runs and generated Assets are retained',
    },
    ...commonErrorResponses,
  },
})

/** Registers the tenant- and owner-scoped Create session API. */
export function registerCreateSessionRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    return c.json(await listCreateSessions({
      ...c.req.valid('query'),
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })

  app.openapi(getRoute, async (c) => {
    return c.json(await getCreateSession({
      id: c.req.valid('param').id,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })

  app.openapi(renameRoute, async (c) => {
    return c.json(await renameCreateSession({
      id: c.req.valid('param').id,
      name: c.req.valid('json').name,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })

  app.openapi(deleteRoute, async (c) => {
    await deleteCreateSession({
      id: c.req.valid('param').id,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    })
    return c.body(null, 204)
  })
}
