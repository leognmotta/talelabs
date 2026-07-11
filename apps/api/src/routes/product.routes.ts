import type { OpenAPIHono } from '@hono/zod-openapi'
import type { OrganizationSessionResolver } from '../middleware/organization.js'
import type { RateLimitStore } from '../rate-limit/rate-limit-store.js'
import type { ApiEnv } from '../types.js'

import { OpenAPIHono as ProductOpenAPIHono } from '@hono/zod-openapi'
import { createOrganizationRateLimitMiddleware } from '../middleware/organization-rate-limit.js'
import { createOrganizationMiddleware } from '../middleware/organization.js'
import { organizationApiRateLimitStore } from '../rate-limit/organization-rate-limit.js'

export type ProductRouteRegistrar = (app: OpenAPIHono<ApiEnv>) => void

export function registerProductRoutes(
  app: OpenAPIHono<ApiEnv>,
  registrars: readonly ProductRouteRegistrar[] = [],
  resolveOrganizationSession?: OrganizationSessionResolver,
  rateLimitStore: RateLimitStore = organizationApiRateLimitStore,
) {
  if (registrars.length === 0)
    return

  const productApp = new ProductOpenAPIHono<ApiEnv>({
    defaultHook: app.defaultHook,
  })

  productApp.use('*', createOrganizationMiddleware(resolveOrganizationSession))
  productApp.use('*', createOrganizationRateLimitMiddleware(rateLimitStore))

  for (const registerRoutes of registrars)
    registerRoutes(productApp)

  app.route('/', productApp)
}
