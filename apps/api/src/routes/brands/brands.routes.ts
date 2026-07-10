import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { apiError } from '../../middleware/error.js'
import { requireOrganization } from '../../middleware/organization.js'
import { createBrand, editBrand, getBrand, listBrands, removeBrand } from '../../services/brands.service.js'
import { invalidCursorError } from '../shared/errors.js'
import { notFoundErrorResponse, organizationErrorResponses, validationErrorResponse } from '../shared/responses.js'
import {
  BrandDetailSchema,
  BrandIdParamsSchema,
  BrandSchema,
  CreateBrandRequestSchema,
  ListBrandsQuerySchema,
  ListBrandsResponseSchema,
  UpdateBrandRequestSchema,
} from './brands.schemas.js'

const notFound = notFoundErrorResponse('Brand')

const listRoute = createRoute({ method: 'get', path: '/brands', operationId: 'listBrands', tags: ['Brands'], request: { query: ListBrandsQuerySchema }, responses: { 200: { content: { 'application/json': { schema: ListBrandsResponseSchema } }, description: 'Brands in the active organization' }, 400: validationErrorResponse, ...organizationErrorResponses } })
const createBrandRoute = createRoute({ method: 'post', path: '/brands', operationId: 'createBrand', tags: ['Brands'], request: { body: { content: { 'application/json': { schema: CreateBrandRequestSchema } }, required: true } }, responses: { 201: { content: { 'application/json': { schema: BrandSchema } }, description: 'Created brand' }, 400: validationErrorResponse, ...organizationErrorResponses } })
const getBrandRoute = createRoute({ method: 'get', path: '/brands/{brandId}', operationId: 'getBrand', tags: ['Brands'], request: { params: BrandIdParamsSchema }, responses: { 200: { content: { 'application/json': { schema: BrandDetailSchema } }, description: 'Brand detail' }, ...organizationErrorResponses, 404: notFound } })
const updateBrandRoute = createRoute({ method: 'patch', path: '/brands/{brandId}', operationId: 'updateBrand', tags: ['Brands'], request: { params: BrandIdParamsSchema, body: { content: { 'application/json': { schema: UpdateBrandRequestSchema } }, required: true } }, responses: { 200: { content: { 'application/json': { schema: BrandSchema } }, description: 'Updated brand' }, 400: validationErrorResponse, ...organizationErrorResponses, 404: notFound } })
const deleteBrandRoute = createRoute({ method: 'delete', path: '/brands/{brandId}', operationId: 'deleteBrand', tags: ['Brands'], request: { params: BrandIdParamsSchema }, responses: { 204: { description: 'Deleted brand' }, ...organizationErrorResponses, 404: notFound } })

export function registerBrandRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const result = await listBrands({ organizationId, ...c.req.valid('query') })
    if (!result.ok)
      return c.json(invalidCursorError, 400)
    return c.json({ data: result.data, nextCursor: result.nextCursor }, 200)
  })
  app.openapi(createBrandRoute, async (c) => {
    const context = requireOrganization(c)
    return c.json(await createBrand({ ...context, ...c.req.valid('json'), createdBy: context.userId }), 201)
  })
  app.openapi(getBrandRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const brand = await getBrand(organizationId, c.req.valid('param').brandId)
    return brand ? c.json(brand, 200) : c.json(apiError('not_found', 'Brand not found.'), 404)
  })
  app.openapi(updateBrandRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const brand = await editBrand({ ...c.req.valid('json'), organizationId, brandId: c.req.valid('param').brandId })
    return brand ? c.json(brand, 200) : c.json(apiError('not_found', 'Brand not found.'), 404)
  })
  app.openapi(deleteBrandRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const deleted = await removeBrand(organizationId, c.req.valid('param').brandId)
    return deleted ? c.body(null, 204) : c.json(apiError('not_found', 'Brand not found.'), 404)
  })
}
