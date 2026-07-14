import { cors } from 'hono/cors'

const LOCAL_DASHBOARD_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  }
  catch {
    return null
  }
}

export function getAllowedCorsOrigins(
  env: Partial<Pick<NodeJS.ProcessEnv, 'DASHBOARD_URL' | 'NODE_ENV'>>
    = process.env,
) {
  const isLocalEnvironment
    = env.NODE_ENV === 'development' || env.NODE_ENV === 'test'
  if (!isLocalEnvironment && !env.DASHBOARD_URL)
    throw new Error('DASHBOARD_URL is required outside local development.')

  const dashboardOrigin = normalizeOrigin(
    env.DASHBOARD_URL ?? 'http://localhost:5173',
  )
  if (!dashboardOrigin)
    throw new Error('DASHBOARD_URL must be a valid absolute URL.')

  const origins = new Set([dashboardOrigin])

  if (isLocalEnvironment) {
    for (const origin of LOCAL_DASHBOARD_ORIGINS)
      origins.add(origin)
  }

  return origins
}

const allowedOrigins = getAllowedCorsOrigins()

export const corsMiddleware = cors({
  origin: origin => allowedOrigins.has(origin) ? origin : null,
  allowHeaders: [
    'Accept-Language',
    'Content-Type',
    'Idempotency-Key',
    'X-TaleLabs-Organization-Id',
  ],
  allowMethods: (_origin, c) => {
    const requestedMethod = c.req.header('Access-Control-Request-Method')

    return requestedMethod
      ? [requestedMethod]
      : ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  },
  exposeHeaders: [
    'Content-Language',
    'Content-Length',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
    'Retry-After',
  ],
  maxAge: 600,
  credentials: true,
})
