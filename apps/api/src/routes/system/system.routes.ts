import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { db, sql } from '@talelabs/db'
import { HealthResponseSchema } from './system.schemas.js'

const healthRoute = createRoute({
  method: 'get',
  path: '/db/health',
  operationId: 'getDbHealth',
  tags: ['System'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'Database connection health',
    },
  },
})

export function registerSystemRoutes(app: OpenAPIHono<ApiEnv>) {
  app.get('/', (c) => {
    return c.text('Hello Hono!')
  })

  app.openapi(healthRoute, async (c) => {
    const result = await sql<{ ok: number }>`select 1 as ok`.execute(db)
    const ok = result.rows[0]?.ok === 1

    return c.json({ ok })
  })
}
