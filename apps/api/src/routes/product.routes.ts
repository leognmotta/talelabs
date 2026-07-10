import type { OpenAPIHono } from '@hono/zod-openapi'
import type { OrganizationSessionResolver } from '../middleware/organization.js'
import type { ApiEnv } from '../types.js'

import { OpenAPIHono as ProductOpenAPIHono } from '@hono/zod-openapi'
import { createOrganizationMiddleware } from '../middleware/organization.js'

export type ProductRouteRegistrar = (app: OpenAPIHono<ApiEnv>) => void

export function registerProductRoutes(
  app: OpenAPIHono<ApiEnv>,
  registrars: readonly ProductRouteRegistrar[] = [],
  resolveOrganizationSession?: OrganizationSessionResolver,
) {
  if (registrars.length === 0)
    return

  const productApp = new ProductOpenAPIHono<ApiEnv>({
    defaultHook: app.defaultHook,
  })

  productApp.use('*', createOrganizationMiddleware(resolveOrganizationSession))

  for (const registerRoutes of registrars)
    registerRoutes(productApp)

  app.route('/', productApp)
}
