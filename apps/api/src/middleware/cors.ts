import { cors } from 'hono/cors'

export const corsMiddleware = cors({
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
})
