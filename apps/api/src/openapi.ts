import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from './types.js'

import { swaggerUI } from '@hono/swagger-ui'
import {
  AssetLifecycleSchema,
  AssetProcessingStateSchema,
  AssetSourceSchema,
  AssetTypeSchema,
  Cuid2Schema,
  CursorSchema,
  JobStatusSchema,
  MediaTypeSchema,
  PaginationLimitSchema,
  PaginationQuerySchema,
  ProductErrorCodeSchema,
  RunModeSchema,
  RunStatusSchema,
  SortOrderSchema,
  TimestampSchema,
} from './schemas/common.js'

const foundationSchemas = {
  AssetLifecycle: AssetLifecycleSchema,
  AssetProcessingState: AssetProcessingStateSchema,
  AssetSource: AssetSourceSchema,
  AssetType: AssetTypeSchema,
  Cuid2: Cuid2Schema,
  Cursor: CursorSchema,
  JobStatus: JobStatusSchema,
  MediaType: MediaTypeSchema,
  PaginationLimit: PaginationLimitSchema,
  PaginationQuery: PaginationQuerySchema,
  ProductErrorCode: ProductErrorCodeSchema,
  RunMode: RunModeSchema,
  RunStatus: RunStatusSchema,
  SortOrder: SortOrderSchema,
  Timestamp: TimestampSchema,
} as const

export function registerOpenApi(app: OpenAPIHono<ApiEnv>) {
  for (const [name, schema] of Object.entries(foundationSchemas))
    app.openAPIRegistry.register(name, schema)

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'TaleLabs API',
      version: '0.1.0',
      description: 'Organization-first TaleLabs API',
    },
    servers: [
      {
        url: 'http://localhost:5174',
        description: 'Local API',
      },
    ],
  })

  app.get('/docs', swaggerUI({ url: '/openapi.json' }))
}
