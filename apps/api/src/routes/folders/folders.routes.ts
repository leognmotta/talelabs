/** Tenant-scoped folder tree reads and structural mutation routes. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import {
  createFolder,
  deleteFolder,
  listFolders,
  listProjectFolderTree,
  updateFolder,
} from '../../services/folders.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateFolderRequestSchema,
  FolderListQuerySchema,
  FolderListResponseSchema,
  FolderParamsSchema,
  FolderSchema,
  ProjectFolderTreeQuerySchema,
  ProjectFolderTreeResponseSchema,
  UpdateFolderRequestSchema,
} from './folders.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/folders',
  tags: ['Folders'],
  request: { query: FolderListQuerySchema },
  responses: {
    200: { description: 'Complete folder tree', content: { 'application/json': { schema: FolderListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const projectTreeRoute = createRoute({
  method: 'get',
  path: '/folders/tree',
  tags: ['Folders'],
  request: { query: ProjectFolderTreeQuerySchema },
  responses: {
    200: {
      description: 'Compact Project folder tree',
      content: {
        'application/json': { schema: ProjectFolderTreeResponseSchema },
      },
    },
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

/** Registers folder metadata reads and structural mutation endpoints. */
export function registerFolderRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    const query = c.req.valid('query')
    return c.json(await listFolders(
      c.var.organizationId,
      query.projectId === 'private' ? null : query.projectId,
    ), 200)
  })

  app.openapi(projectTreeRoute, async (c) => {
    return c.json(await listProjectFolderTree(
      c.var.organizationId,
      c.req.valid('query').projectId,
    ), 200)
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
