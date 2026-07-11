import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { createUpload } from '../../services/upload.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateUploadRequestSchema,
  CreateUploadResponseSchema,
} from './uploads.schemas.js'

const createUploadRoute = createRoute({
  method: 'post',
  path: '/uploads',
  tags: ['Uploads'],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateUploadRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'Presigned create-only upload grant',
      content: { 'application/json': { schema: CreateUploadResponseSchema } },
    },
    ...commonErrorResponses,
  },
})

export function registerUploadRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(createUploadRoute, async (c) => {
    const body = c.req.valid('json')
    const result = await createUpload({
      ...body,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    })
    return c.json(result, 201)
  })
}
