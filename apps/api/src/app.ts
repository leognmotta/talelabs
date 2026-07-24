/** Composes the API Hono app: middleware, auth, and product route mounts. */

import type { RateLimitStore } from '@talelabs/cache'
import type { OrganizationSessionResolver } from './middleware/organization.js'
import type { ProductRouteRegistrar } from './routes/product.routes.js'
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
import { registerAssetRoutes } from './routes/assets/assets.routes.js'
import { registerConfigRoutes } from './routes/config/config.routes.js'
import { registerCreateSessionRoutes } from './routes/create-sessions/create-sessions.routes.js'
import { registerElementRoutes } from './routes/elements/elements.routes.js'
import { registerFlowRoutes } from './routes/flows/flows.routes.js'
import { registerFolderRoutes } from './routes/folders/folders.routes.js'
import { registerOrganizationRoutes } from './routes/organizations/organizations.routes.js'
import { registerProductRoutes } from './routes/product.routes.js'
import { registerOpenRouterVideoCallbackRoutes } from './routes/provider-callbacks/openrouter-video-callback.routes.js'
import { registerRunRoutes } from './routes/runs/runs.routes.js'
import { registerSearchRoutes } from './routes/search/search.routes.js'
import { registerSystemRoutes } from './routes/system/system.routes.js'
import { registerTagRoutes } from './routes/tags/tags.routes.js'
import { registerUploadRoutes } from './routes/uploads/uploads.routes.js'

const defaultProductRouteRegistrars = [
  registerUploadRoutes,
  registerAssetRoutes,
  registerElementRoutes,
  registerCreateSessionRoutes,
  registerFlowRoutes,
  registerRunRoutes,
  registerConfigRoutes,
  registerFolderRoutes,
  registerTagRoutes,
  registerSearchRoutes,
]

function getValidationIssueDetails(issue: {
  code: string
  path: PropertyKey[]
}) {
  const metadata = issue as unknown as Record<string, unknown>
  const params: Record<string, boolean | number | string> = {}
  let code = issue.code

  if (issue.code === 'too_small') {
    const minimum = metadata.minimum
    const origin = metadata.origin

    if (typeof minimum === 'number')
      params.minimum = minimum

    code = origin === 'string' ? 'min_length' : 'min_value'
  }
  else if (issue.code === 'too_big') {
    const maximum = metadata.maximum
    const origin = metadata.origin

    if (typeof maximum === 'number')
      params.maximum = maximum

    code = origin === 'string' ? 'max_length' : 'max_value'
  }
  else if (issue.code === 'invalid_format' && typeof metadata.format === 'string') {
    code = `invalid_${metadata.format}`
  }
  else if (issue.code === 'invalid_type' && metadata.input === undefined) {
    code = 'required'
  }

  return {
    code,
    field: issue.path.map(String).join('.'),
    params: Object.keys(params).length ? params : undefined,
  }
}

/** Injectable composition options for the API app. */
export interface CreateApiAppOptions {
  /** Resolver mapping a session to its active organization. */
  organizationSessionResolver?: OrganizationSessionResolver
  /** Product route registrars mounted under the authenticated API. */
  productRouteRegistrars?: readonly ProductRouteRegistrar[]
  /** Backing store for rate-limit admission control. */
  rateLimitStore?: RateLimitStore
}

/** Builds and wires the API Hono app from injected composition options. */
export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(apiError(
          'validation_error',
          'The request could not be validated.',
          result.error.issues.map(issue => ({
            ...getValidationIssueDetails(issue),
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

  registerOpenRouterVideoCallbackRoutes(app)

  app.use('/me', authMiddleware, requireAuthMiddleware)
  app.use('/me/*', authMiddleware, requireAuthMiddleware)
  app.use('/organizations', authMiddleware, requireAuthMiddleware)
  app.use('/organizations/*', authMiddleware, requireAuthMiddleware)

  registerSystemRoutes(app)
  registerAccountRoutes(app)
  registerOrganizationRoutes(app)
  registerOpenApi(app)
  registerProductRoutes(
    app,
    options.productRouteRegistrars ?? defaultProductRouteRegistrars,
    options.organizationSessionResolver,
    options.rateLimitStore,
  )

  return app
}

export default createApiApp()
