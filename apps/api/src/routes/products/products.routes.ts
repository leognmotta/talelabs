import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'
import { createRoute } from '@hono/zod-openapi'
import { apiError } from '../../middleware/error.js'
import { requireOrganization } from '../../middleware/organization.js'
import {
  createProduct,
  editProduct,
  getProduct,
  listProducts,
  removeProduct,
} from '../../services/products.service.js'
import { invalidCursorError } from '../shared/errors.js'
import {
  notFoundErrorResponse,
  organizationErrorResponses,
  validationErrorResponse,
} from '../shared/responses.js'
import {
  CreateProductRequestSchema,
  ListProductsQuerySchema,
  ListProductsResponseSchema,
  ProductDetailSchema,
  ProductIdParamsSchema,
  ProductSchema,
  UpdateProductRequestSchema,
} from './products.schemas.js'

const notFound = notFoundErrorResponse('Product')
const listRoute = createRoute({
  method: 'get',
  path: '/products',
  operationId: 'listProducts',
  tags: ['Products'],
  request: { query: ListProductsQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ListProductsResponseSchema } },
      description: 'Products in the active organization',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
  },
})
const createRouteDefinition = createRoute({
  method: 'post',
  path: '/products',
  operationId: 'createProduct',
  tags: ['Products'],
  request: {
    body: {
      content: { 'application/json': { schema: CreateProductRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProductSchema } },
      description: 'Created product',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
    404: notFound,
  },
})
const getRoute = createRoute({
  method: 'get',
  path: '/products/{productId}',
  operationId: 'getProduct',
  tags: ['Products'],
  request: { params: ProductIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ProductDetailSchema } },
      description: 'Product detail',
    },
    ...organizationErrorResponses,
    404: notFound,
  },
})
const updateRoute = createRoute({
  method: 'patch',
  path: '/products/{productId}',
  operationId: 'updateProduct',
  tags: ['Products'],
  request: {
    params: ProductIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateProductRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProductSchema } },
      description: 'Updated product',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
    404: notFound,
  },
})
const deleteRoute = createRoute({
  method: 'delete',
  path: '/products/{productId}',
  operationId: 'deleteProduct',
  tags: ['Products'],
  request: { params: ProductIdParamsSchema },
  responses: {
    204: { description: 'Deleted product' },
    ...organizationErrorResponses,
    404: notFound,
  },
})

export function registerProductRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const result = await listProducts({
      organizationId,
      ...c.req.valid('query'),
    })
    return result.ok
      ? c.json({ data: result.data, nextCursor: result.nextCursor }, 200)
      : c.json(invalidCursorError, 400)
  })
  app.openapi(createRouteDefinition, async (c) => {
    const context = requireOrganization(c)
    const result = await createProduct({
      ...context,
      ...c.req.valid('json'),
      createdBy: context.userId,
    })
    return result.ok
      ? c.json(result.product, 201)
      : c.json(apiError('not_found', 'Brand not found.'), 404)
  })
  app.openapi(getRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const product = await getProduct(
      organizationId,
      c.req.valid('param').productId,
    )
    return product
      ? c.json(product, 200)
      : c.json(apiError('not_found', 'Product not found.'), 404)
  })
  app.openapi(updateRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const result = await editProduct({
      ...c.req.valid('json'),
      organizationId,
      productId: c.req.valid('param').productId,
    })
    return result.ok
      ? c.json(result.product, 200)
      : c.json(
          apiError(
            'not_found',
            result.reason === 'brand_not_found'
              ? 'Brand not found.'
              : 'Product not found.',
          ),
          404,
        )
  })
  app.openapi(deleteRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    return (await removeProduct(organizationId, c.req.valid('param').productId))
      ? c.body(null, 204)
      : c.json(apiError('not_found', 'Product not found.'), 404)
  })
}
