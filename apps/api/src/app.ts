import { auth, requireOrganizationSession } from '@connecto/auth'
import { db, sql } from '@connecto/db'
import { swaggerUI } from '@hono/swagger-ui'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { cors } from 'hono/cors'

const app = new OpenAPIHono()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: (_origin, c) => {
      const requestedMethod = c.req.header('Access-Control-Request-Method')

      return requestedMethod
        ? [requestedMethod]
        : ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    },
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
)

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

const HealthResponseSchema = z.object({
  ok: z.boolean().openapi({ example: true }),
}).openapi('HealthResponse')

const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: 'Authentication required' }),
}).openapi('ErrorResponse')

const MeResponseSchema = z.object({
  activeOrganizationId: z.string().openapi({
    example: 'org_123',
  }),
  session: z.object({
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    id: z.string(),
  }),
  user: z.object({
    email: z.email().openapi({ example: 'mail@leomotta.me' }),
    id: z.string().openapi({ example: 'user_123' }),
    name: z.string().openapi({ example: 'Leonardo Motta' }),
  }),
}).openapi('MeResponse')

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

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  operationId: 'getMe',
  tags: ['Account'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeResponseSchema,
        },
      },
      description: 'Authenticated user and active organization session',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Active organization required',
    },
  },
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.openapi(healthRoute, async (c) => {
  const result = await sql<{ ok: number }>`select 1 as ok`.execute(db)
  const ok = result.rows[0]?.ok === 1

  return c.json({ ok })
})

app.openapi(meRoute, async (c) => {
  const result = await requireOrganizationSession(c.req.raw.headers)

  if (!result.ok && result.status === 401)
    return c.json({ error: result.error }, 401)

  if (!result.ok)
    return c.json({ error: result.error }, 403)

  return c.json({
    activeOrganizationId: result.activeOrganizationId,
    session: {
      id: result.session.session.id,
      createdAt: result.session.session.createdAt.toISOString(),
      expiresAt: result.session.session.expiresAt.toISOString(),
    },
    user: {
      id: result.session.user.id,
      email: result.session.user.email,
      name: result.session.user.name,
    },
  }, 200)
})

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Connecto API',
    version: '0.1.0',
    description: 'Organization-first Connecto API',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local API',
    },
  ],
})

app.get('/docs', swaggerUI({ url: '/openapi.json' }))

export default app
