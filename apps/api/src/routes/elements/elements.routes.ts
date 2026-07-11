import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'

import {
  attachElementAsset,
  createElement,
  deleteElement,
  getElementDetail,
  getElementUsage,
  listElementAssets,
  listElements,
  unlinkElementAsset,
  updateElement,
  updateElementAsset,
} from '../../services/elements.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreatedElementSchema,
  CreateElementAssetRequestSchema,
  CreateElementRequestSchema,
  DeleteElementAssetQuerySchema,
  ElementAssetLinkSchema,
  ElementAssetListQuerySchema,
  ElementAssetListResponseSchema,
  ElementAssetParamsSchema,
  ElementDetailSchema,
  ElementListQuerySchema,
  ElementListResponseSchema,
  ElementParamsSchema,
  ElementSchema,
  ElementUsageSchema,
  UpdateElementAssetRequestSchema,
  UpdateElementRequestSchema,
} from './elements.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/elements',
  tags: ['Elements'],
  request: { query: ElementListQuerySchema },
  responses: {
    200: { description: 'Element list page', content: { 'application/json': { schema: ElementListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const createRouteDefinition = createRoute({
  method: 'post',
  path: '/elements',
  tags: ['Elements'],
  request: { body: { required: true, content: { 'application/json': { schema: CreateElementRequestSchema } } } },
  responses: {
    201: { description: 'Element and Asset folder created', content: { 'application/json': { schema: CreatedElementSchema } } },
    ...commonErrorResponses,
  },
})

const detailRoute = createRoute({
  method: 'get',
  path: '/elements/{id}',
  tags: ['Elements'],
  request: { params: ElementParamsSchema },
  responses: {
    200: { description: 'Element detail', content: { 'application/json': { schema: ElementDetailSchema } } },
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
    200: { description: 'Element updated', content: { 'application/json': { schema: ElementSchema } } },
    ...commonErrorResponses,
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/elements/{id}',
  tags: ['Elements'],
  request: { params: ElementParamsSchema },
  responses: {
    204: { description: 'Element deleted; canonical Assets survive' },
    ...commonErrorResponses,
  },
})

const listAssetsRoute = createRoute({
  method: 'get',
  path: '/elements/{id}/assets',
  tags: ['Elements'],
  request: { params: ElementParamsSchema, query: ElementAssetListQuerySchema },
  responses: {
    200: { description: 'Element Asset kit', content: { 'application/json': { schema: ElementAssetListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const attachAssetRoute = createRoute({
  method: 'post',
  path: '/elements/{id}/assets',
  tags: ['Elements'],
  request: {
    params: ElementParamsSchema,
    body: { required: true, content: { 'application/json': { schema: CreateElementAssetRequestSchema } } },
  },
  responses: {
    201: { description: 'Canonical Asset attached to Element', content: { 'application/json': { schema: ElementAssetLinkSchema } } },
    ...commonErrorResponses,
  },
})

const updateAssetRoute = createRoute({
  method: 'patch',
  path: '/elements/{id}/assets/{assetId}',
  tags: ['Elements'],
  request: {
    params: ElementAssetParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UpdateElementAssetRequestSchema } } },
  },
  responses: {
    200: { description: 'Element Asset link updated', content: { 'application/json': { schema: ElementAssetLinkSchema } } },
    ...commonErrorResponses,
  },
})

const unlinkAssetRoute = createRoute({
  method: 'delete',
  path: '/elements/{id}/assets/{assetId}',
  tags: ['Elements'],
  request: { params: ElementAssetParamsSchema, query: DeleteElementAssetQuerySchema },
  responses: {
    204: { description: 'Element link removed; canonical Asset survives' },
    ...commonErrorResponses,
  },
})

const usageRoute = createRoute({
  method: 'get',
  path: '/elements/{id}/usage',
  tags: ['Elements'],
  request: { params: ElementParamsSchema },
  responses: {
    200: { description: 'Bounded Element usage summary', content: { 'application/json': { schema: ElementUsageSchema } } },
    ...commonErrorResponses,
  },
})

export function registerElementRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async c => c.json(await listElements({
    ...c.req.valid('query'),
    organizationId: c.var.organizationId,
  }) as never, 200))

  app.openapi(createRouteDefinition, async c => c.json(await createElement({
    ...c.req.valid('json'),
    createdBy: c.var.userId,
    organizationId: c.var.organizationId,
  }) as never, 201))

  app.openapi(detailRoute, async c => c.json(await getElementDetail(
    c.var.organizationId,
    c.req.valid('param').id,
  ) as never, 200))

  app.openapi(updateRoute, async c => c.json(await updateElement({
    ...c.req.valid('json'),
    id: c.req.valid('param').id,
    organizationId: c.var.organizationId,
  }) as never, 200))

  app.openapi(deleteRoute, async (c) => {
    await deleteElement(c.var.organizationId, c.req.valid('param').id)
    return c.body(null, 204)
  })

  app.openapi(listAssetsRoute, async c => c.json(await listElementAssets({
    ...c.req.valid('query'),
    elementId: c.req.valid('param').id,
    organizationId: c.var.organizationId,
    userId: c.var.userId,
  }) as never, 200))

  app.openapi(attachAssetRoute, async c => c.json(await attachElementAsset({
    ...c.req.valid('json'),
    elementId: c.req.valid('param').id,
    organizationId: c.var.organizationId,
    userId: c.var.userId,
  }) as never, 201))

  app.openapi(updateAssetRoute, async (c) => {
    const params = c.req.valid('param')
    return c.json(await updateElementAsset({
      ...c.req.valid('json'),
      assetId: params.assetId,
      elementId: params.id,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }) as never, 200)
  })

  app.openapi(unlinkAssetRoute, async (c) => {
    const params = c.req.valid('param')
    await unlinkElementAsset({
      ...c.req.valid('query'),
      assetId: params.assetId,
      elementId: params.id,
      organizationId: c.var.organizationId,
    })
    return c.body(null, 204)
  })

  app.openapi(usageRoute, async c => c.json(await getElementUsage(
    c.var.organizationId,
    c.req.valid('param').id,
  ) as never, 200))
}
