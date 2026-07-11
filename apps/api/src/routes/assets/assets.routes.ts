import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import {
  addAssetTag,
  favoriteAsset,
  removeAssetTag,
  unfavoriteAsset,
} from '../../services/asset-metadata.service.js'
import {
  archiveAsset,
  getAssetDetail,
  getAssetDownload,
  listAssets,
  listAssetUsage,
  moveAssets,
  presentAssetForUser,
  purgeAsset,
  restoreAsset,
  updateAsset,
} from '../../services/assets.service.js'
import { registerUploadedAsset } from '../../services/upload.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  AssetDetailSchema,
  AssetDownloadResponseSchema,
  AssetListQuerySchema,
  AssetListResponseSchema,
  AssetParamsSchema,
  AssetSchema,
  AssetTagParamsSchema,
  AssetUsageListResponseSchema,
  AssetUsageQuerySchema,
  MoveAssetsRequestSchema,
  MoveAssetsResponseSchema,
  RegisterAssetRequestSchema,
  UpdateAssetRequestSchema,
} from './assets.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/assets',
  tags: ['Assets'],
  request: { query: AssetListQuerySchema },
  responses: {
    200: { description: 'Asset library page', content: { 'application/json': { schema: AssetListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const registerRoute = createRoute({
  method: 'post',
  path: '/assets',
  tags: ['Assets'],
  request: { body: { required: true, content: { 'application/json': { schema: RegisterAssetRequestSchema } } } },
  responses: {
    200: { description: 'Existing registration replayed', content: { 'application/json': { schema: AssetSchema } } },
    201: { description: 'Uploaded object registered', content: { 'application/json': { schema: AssetSchema } } },
    ...commonErrorResponses,
  },
})

const detailRoute = createRoute({
  method: 'get',
  path: '/assets/{id}',
  tags: ['Assets'],
  request: { params: AssetParamsSchema },
  responses: {
    200: { description: 'Render-complete asset detail', content: { 'application/json': { schema: AssetDetailSchema } } },
    ...commonErrorResponses,
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/assets/{id}',
  tags: ['Assets'],
  request: {
    params: AssetParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UpdateAssetRequestSchema } } },
  },
  responses: {
    200: { description: 'Updated asset', content: { 'application/json': { schema: AssetSchema } } },
    ...commonErrorResponses,
  },
})

const moveRoute = createRoute({
  method: 'post',
  path: '/assets/move',
  tags: ['Assets'],
  request: {
    body: { required: true, content: { 'application/json': { schema: MoveAssetsRequestSchema } } },
  },
  responses: {
    200: { description: 'Assets moved atomically', content: { 'application/json': { schema: MoveAssetsResponseSchema } } },
    ...commonErrorResponses,
  },
})

const archiveRoute = createRoute({
  method: 'delete',
  path: '/assets/{id}',
  tags: ['Assets'],
  request: { params: AssetParamsSchema },
  responses: {
    204: { description: 'Asset archived' },
    ...commonErrorResponses,
  },
})

const restoreRoute = createRoute({
  method: 'post',
  path: '/assets/{id}/restore',
  tags: ['Assets'],
  request: { params: AssetParamsSchema },
  responses: {
    200: { description: 'Asset restored', content: { 'application/json': { schema: AssetSchema } } },
    ...commonErrorResponses,
  },
})

const purgeRoute = createRoute({
  method: 'post',
  path: '/assets/{id}/purge',
  tags: ['Assets'],
  request: { params: AssetParamsSchema },
  responses: {
    200: { description: 'Purge was already requested', content: { 'application/json': { schema: AssetSchema } } },
    202: { description: 'Permanent deletion requested', content: { 'application/json': { schema: AssetSchema } } },
    ...commonErrorResponses,
  },
})

const usageRoute = createRoute({
  method: 'get',
  path: '/assets/{id}/usage',
  tags: ['Assets'],
  request: { params: AssetParamsSchema, query: AssetUsageQuerySchema },
  responses: {
    200: { description: 'Generation usage page', content: { 'application/json': { schema: AssetUsageListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const downloadRoute = createRoute({
  method: 'get',
  path: '/assets/{id}/download',
  tags: ['Assets'],
  request: { params: AssetParamsSchema },
  responses: {
    200: { description: 'Short-lived attachment URL', content: { 'application/json': { schema: AssetDownloadResponseSchema } } },
    ...commonErrorResponses,
  },
})

const favoriteRoute = createRoute({
  method: 'put',
  path: '/assets/{id}/favorite',
  tags: ['Assets'],
  request: { params: AssetParamsSchema },
  responses: {
    204: { description: 'Asset favorited for the current user in this organization' },
    ...commonErrorResponses,
  },
})

const unfavoriteRoute = createRoute({
  method: 'delete',
  path: '/assets/{id}/favorite',
  tags: ['Assets'],
  request: { params: AssetParamsSchema },
  responses: {
    204: { description: 'Current user favorite removed' },
    ...commonErrorResponses,
  },
})

const addTagRoute = createRoute({
  method: 'put',
  path: '/assets/{id}/tags/{tagId}',
  tags: ['Assets'],
  request: { params: AssetTagParamsSchema },
  responses: {
    204: { description: 'Tag assigned to asset' },
    ...commonErrorResponses,
  },
})

const removeTagRoute = createRoute({
  method: 'delete',
  path: '/assets/{id}/tags/{tagId}',
  tags: ['Assets'],
  request: { params: AssetTagParamsSchema },
  responses: {
    204: { description: 'Tag removed from asset' },
    ...commonErrorResponses,
  },
})

export function registerAssetRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    return c.json(await listAssets({
      ...c.req.valid('query'),
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })

  app.openapi(registerRoute, async (c) => {
    const result = await registerUploadedAsset({
      ...c.req.valid('json'),
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    })
    const asset = await presentAssetForUser({
      asset: result.asset,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    })
    return result.replay ? c.json(asset, 200) : c.json(asset, 201)
  })

  app.openapi(moveRoute, async (c) => {
    return c.json(await moveAssets({
      ...c.req.valid('json'),
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })

  app.openapi(detailRoute, async (c) => {
    const detail = await getAssetDetail(
      c.var.organizationId,
      c.var.userId,
      c.req.valid('param').id,
    )
    return c.json(detail as never, 200)
  })

  app.openapi(updateRoute, async (c) => {
    return c.json(await updateAsset({
      ...c.req.valid('json'),
      id: c.req.valid('param').id,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })

  app.openapi(archiveRoute, async (c) => {
    await archiveAsset(c.var.organizationId, c.req.valid('param').id)
    return c.body(null, 204)
  })

  app.openapi(restoreRoute, async (c) => {
    return c.json(await restoreAsset(
      c.var.organizationId,
      c.var.userId,
      c.req.valid('param').id,
    ), 200)
  })

  app.openapi(purgeRoute, async (c) => {
    const result = await purgeAsset(
      c.var.organizationId,
      c.var.userId,
      c.req.valid('param').id,
    )
    return result.alreadyRequested
      ? c.json(result.asset, 200)
      : c.json(result.asset, 202)
  })

  app.openapi(usageRoute, async (c) => {
    return c.json(await listAssetUsage({
      ...c.req.valid('query'),
      assetId: c.req.valid('param').id,
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(downloadRoute, async (c) => {
    return c.json(await getAssetDownload(c.var.organizationId, c.req.valid('param').id), 200)
  })

  app.openapi(favoriteRoute, async (c) => {
    await favoriteAsset({
      assetId: c.req.valid('param').id,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    })
    return c.body(null, 204)
  })

  app.openapi(unfavoriteRoute, async (c) => {
    await unfavoriteAsset({
      assetId: c.req.valid('param').id,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    })
    return c.body(null, 204)
  })

  app.openapi(addTagRoute, async (c) => {
    const params = c.req.valid('param')
    await addAssetTag({
      assetId: params.id,
      organizationId: c.var.organizationId,
      tagId: params.tagId,
      userId: c.var.userId,
    })
    return c.body(null, 204)
  })

  app.openapi(removeTagRoute, async (c) => {
    const params = c.req.valid('param')
    await removeAssetTag({
      assetId: params.id,
      organizationId: c.var.organizationId,
      tagId: params.tagId,
    })
    return c.body(null, 204)
  })
}
