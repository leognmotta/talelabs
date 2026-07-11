import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from '../../services/folders.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateFolderRequestSchema,
  FolderListResponseSchema,
  FolderParamsSchema,
  FolderSchema,
  UpdateFolderRequestSchema,
} from './folders.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/folders',
  tags: ['Folders'],
  responses: {
    200: { description: 'Complete folder tree', content: { 'application/json': { schema: FolderListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const createFolderRoute = createRoute({
  method: 'post',
  path: '/folders',
  tags: ['Folders'],
  request: { body: { required: true, content: { 'application/json': { schema: CreateFolderRequestSchema } } } },
  responses: {
    201: { description: 'Folder created', content: { 'application/json': { schema: FolderSchema } } },
    ...commonErrorResponses,
  },
})

const updateFolderRoute = createRoute({
  method: 'patch',
  path: '/folders/{id}',
  tags: ['Folders'],
  request: {
    params: FolderParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UpdateFolderRequestSchema } } },
  },
  responses: {
    200: { description: 'Folder updated', content: { 'application/json': { schema: FolderSchema } } },
    ...commonErrorResponses,
  },
})

const deleteFolderRoute = createRoute({
  method: 'delete',
  path: '/folders/{id}',
  tags: ['Folders'],
  request: { params: FolderParamsSchema },
  responses: {
    204: { description: 'Folder tree deleted; contained assets moved to root' },
    ...commonErrorResponses,
  },
})

export function registerFolderRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    return c.json(await listFolders(c.var.organizationId), 200)
  })

  app.openapi(createFolderRoute, async (c) => {
    return c.json(await createFolder({
      ...c.req.valid('json'),
      organizationId: c.var.organizationId,
    }), 201)
  })

  app.openapi(updateFolderRoute, async (c) => {
    return c.json(await updateFolder({
      ...c.req.valid('json'),
      id: c.req.valid('param').id,
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(deleteFolderRoute, async (c) => {
    await deleteFolder(c.var.organizationId, c.req.valid('param').id)
    return c.body(null, 204)
  })
}
