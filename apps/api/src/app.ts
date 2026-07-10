import type { ApiEnv } from './types.js'
import { OpenAPIHono } from '@hono/zod-openapi'
import { auth } from '@talelabs/auth'
import {
  authMiddleware,
  requireAuthMiddleware,
} from './middleware/auth.js'
import { corsMiddleware } from './middleware/cors.js'
import { apiError, errorHandler } from './middleware/error.js'
import { registerOpenApi } from './openapi.js'
import { registerAccountRoutes } from './routes/account/account.routes.js'
import { registerOrganizationRoutes } from './routes/organizations/organizations.routes.js'
import { registerSystemRoutes } from './routes/system/system.routes.js'

const app = new OpenAPIHono<ApiEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(apiError(
        'validation_error',
        'The request could not be validated.',
        result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      ), 400)
    }
  },
})

app.onError(errorHandler)

app.use('*', corsMiddleware)

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

app.use('/me', authMiddleware, requireAuthMiddleware)
app.use('/me/*', authMiddleware, requireAuthMiddleware)
app.use('/organizations', authMiddleware, requireAuthMiddleware)
app.use('/organizations/*', authMiddleware, requireAuthMiddleware)

registerSystemRoutes(app)
registerAccountRoutes(app)
registerOrganizationRoutes(app)
registerOpenApi(app)

export default app
