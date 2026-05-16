import { auth, requireOrganizationSession } from '@connecto/auth'
import { db, sql } from '@connecto/db'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use(
  '/api/auth/*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
)

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/db/health', async (c) => {
  const result = await sql<{ ok: number }>`select 1 as ok`.execute(db)
  const ok = result.rows[0]?.ok === 1

  return c.json({ ok })
})

app.get('/session', async (c) => {
  const result = await requireOrganizationSession(c.req.raw.headers)

  if (!result.ok)
    return c.json({ error: result.error }, result.status)

  return c.json({
    user: result.session.user,
    session: result.session.session,
    activeOrganizationId: result.activeOrganizationId,
  })
})

serve({
  fetch: app.fetch,
  port: 3000,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
