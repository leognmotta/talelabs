import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { createTag, deleteTag, listTags } from '../../services/tags.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateTagRequestSchema,
  TagListResponseSchema,
  TagParamsSchema,
  TagSchema,
} from './tags.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/tags',
  tags: ['Tags'],
  responses: {
    200: { description: 'Organization tags', content: { 'application/json': { schema: TagListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const createRouteDefinition = createRoute({
  method: 'post',
  path: '/tags',
  tags: ['Tags'],
  request: { body: { required: true, content: { 'application/json': { schema: CreateTagRequestSchema } } } },
  responses: {
    201: { description: 'Tag created or existing tag returned', content: { 'application/json': { schema: TagSchema } } },
    ...commonErrorResponses,
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/tags/{id}',
  tags: ['Tags'],
  request: { params: TagParamsSchema },
  responses: {
    204: { description: 'Tag deleted from the organization and its assets' },
    ...commonErrorResponses,
  },
})

export function registerTagRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    return c.json(await listTags(c.var.organizationId), 200)
  })

  app.openapi(createRouteDefinition, async (c) => {
    return c.json(await createTag({
      ...c.req.valid('json'),
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 201)
  })

  app.openapi(deleteRoute, async (c) => {
    await deleteTag(c.var.organizationId, c.req.valid('param').id)
    return c.body(null, 204)
  })
}
