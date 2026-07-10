import { cors } from 'hono/cors'

export const corsMiddleware = cors({
  origin: '*',
  allowHeaders: ['Accept-Language', 'Content-Type'],
  allowMethods: (_origin, c) => {
    const requestedMethod = c.req.header('Access-Control-Request-Method')

    return requestedMethod
      ? [requestedMethod]
      : ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  },
  exposeHeaders: ['Content-Language', 'Content-Length'],
  maxAge: 600,
  credentials: true,
})
