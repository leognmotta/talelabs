import type { OrganizationSessionResolver } from './middleware/organization.js'
import type { RateLimitStore } from './rate-limit/rate-limit-store.js'
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

export interface CreateApiAppOptions {
  organizationSessionResolver?: OrganizationSessionResolver
  productRouteRegistrars?: readonly ProductRouteRegistrar[]
  rateLimitStore?: RateLimitStore
}

export function createApiApp(options: CreateApiAppOptions = {}) {
  const app = new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const referenceMetadataIssues = result.error.issues.filter(issue =>
          issue.path.includes('referenceMetadata'))
        if (referenceMetadataIssues.length) {
          return c.json(apiError(
            'element_reference_metadata_invalid',
            'Element reference metadata is invalid.',
            referenceMetadataIssues.map(issue => ({
              code: 'element_reference_metadata_invalid',
              field: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          ), 400)
        }
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
