import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from './types.js'

import { swaggerUI } from '@hono/swagger-ui'

export function registerOpenApi(app: OpenAPIHono<ApiEnv>) {
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
