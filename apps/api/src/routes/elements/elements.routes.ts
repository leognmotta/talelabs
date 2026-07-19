/** HTTP routes for Element management. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'

import {
  createElement,
  deleteElement,
  getElementDetail,
  listElements,
  mutateElementReferences,
  updateElement,
} from '../../services/elements.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateElementRequestSchema,
  ElementDetailSchema,
  ElementListQuerySchema,
  ElementListResponseSchema,
  ElementParamsSchema,
  ElementReferenceMutationSchema,
  MutateElementReferencesRequestSchema,
  UpdateElementRequestSchema,
} from './elements.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/elements',
  tags: ['Elements'],
  request: { query: ElementListQuerySchema },
  responses: {
    200: { description: 'Organization Elements', content: { 'application/json': { schema: ElementListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const createRouteDefinition = createRoute({
  method: 'post',
  path: '/elements',
  tags: ['Elements'],
  request: { body: { required: true, content: { 'application/json': { schema: CreateElementRequestSchema } } } },
  responses: {
    201: { description: 'Element created', content: { 'application/json': { schema: ElementDetailSchema } } },
    ...commonErrorResponses,
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/elements/{id}',
  tags: ['Elements'],
  request: { params: ElementParamsSchema },
  responses: {
    200: { description: 'Element detail with ordered references', content: { 'application/json': { schema: ElementDetailSchema } } },
    ...commonErrorResponses,
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/elements/{id}',
  tags: ['Elements'],
  request: {
    params: ElementParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UpdateElementRequestSchema } } },
  },
  responses: {
    200: { description: 'Element updated', content: { 'application/json': { schema: ElementDetailSchema } } },
    ...commonErrorResponses,
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/elements/{id}',
  tags: ['Elements'],
  request: { params: ElementParamsSchema },
  responses: {
    204: { description: 'Element deleted; canonical Assets are untouched' },
    ...commonErrorResponses,
  },
})

const mutateReferencesRoute = createRoute({
  method: 'patch',
  path: '/elements/{id}/references',
  tags: ['Elements'],
  request: {
    params: ElementParamsSchema,
    body: { required: true, content: { 'application/json': { schema: MutateElementReferencesRequestSchema } } },
  },
  responses: {
    200: { description: 'References added/removed against current server state', content: { 'application/json': { schema: ElementReferenceMutationSchema } } },
    ...commonErrorResponses,
  },
})

/** Mounts every Element route on the product API. */
export function registerElementRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    return c.json(await listElements({
      ...c.req.valid('query'),
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(createRouteDefinition, async (c) => {
    const body = c.req.valid('json')
    return c.json(await createElement({
      assetIds: body.assetIds ?? [],
      description: body.description ?? '',
      kind: body.kind,
      name: body.name,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 201)
  })

  app.openapi(getRoute, async (c) => {
    return c.json(await getElementDetail(
      c.var.organizationId,
      c.req.valid('param').id,
    ), 200)
  })

  app.openapi(updateRoute, async (c) => {
    return c.json(await updateElement({
      ...c.req.valid('json'),
      id: c.req.valid('param').id,
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(deleteRoute, async (c) => {
    await deleteElement(c.var.organizationId, c.req.valid('param').id)
    return c.body(null, 204)
  })

  app.openapi(mutateReferencesRoute, async (c) => {
    const body = c.req.valid('json')
    return c.json(await mutateElementReferences({
      addAssetIds: body.add ?? [],
      elementId: c.req.valid('param').id,
      organizationId: c.var.organizationId,
      removeAssetIds: body.remove ?? [],
    }), 200)
  })
}
