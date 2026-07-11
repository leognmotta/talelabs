import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { searchWorkspace } from '../../services/search.service.js'
import { commonErrorResponses } from '../product.responses.js'
import { SearchQuerySchema, SearchResponseSchema } from './search.schemas.js'

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Search'],
  request: { query: SearchQuerySchema },
  responses: {
    200: { description: 'Compact workspace search results', content: { 'application/json': { schema: SearchResponseSchema } } },
    ...commonErrorResponses,
  },
})

export function registerSearchRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(searchRoute, async (c) => {
    const query = c.req.valid('query')
    const types = query.type
      ? Array.isArray(query.type) ? query.type : [query.type]
      : ['asset', 'element', 'folder'] as const

    return c.json(await searchWorkspace({
      limit: query.limit,
      organizationId: c.var.organizationId,
      query: query.q,
      types: [...types],
    }), 200)
  })
}
