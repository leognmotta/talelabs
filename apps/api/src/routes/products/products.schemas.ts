import { z } from '@hono/zod-openapi'
import { ListQuerySchema, ResourceIdSchema } from '../../schemas/common.js'

export const ProductSchema = z
  .object({
    id: ResourceIdSchema,
    brandId: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    features: z.array(z.string()),
    benefits: z.array(z.string()),
    createdBy: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Product')
export const ProductDetailSchema = ProductSchema.extend({
  kitCounts: z.record(z.string(), z.number()),
}).openapi('ProductDetail')
export const ProductIdParamsSchema = z.object({ productId: ResourceIdSchema })
export const ListProductsQuerySchema = ListQuerySchema.extend({
  brandId: ResourceIdSchema.optional(),
})
export const ListProductsResponseSchema = z
  .object({ data: z.array(ProductSchema), nextCursor: z.string().nullable() })
  .openapi('ListProductsResponse')
const fields = {
  name: z.string().trim().min(1).max(160),
  brandId: ResourceIdSchema,
  description: z.string().trim().max(4000),
  features: z.array(z.string().trim().min(1).max(500)).max(100),
  benefits: z.array(z.string().trim().min(1).max(500)).max(100),
}
export const CreateProductRequestSchema = z
  .object({
    name: fields.name,
    brandId: fields.brandId.optional(),
    description: fields.description.optional(),
    features: fields.features.optional(),
    benefits: fields.benefits.optional(),
  })
  .openapi('CreateProductRequest')
export const UpdateProductRequestSchema = z
  .object({
    name: fields.name.optional(),
    brandId: fields.brandId.nullable().optional(),
    description: fields.description.nullable().optional(),
    features: fields.features.optional(),
    benefits: fields.benefits.optional(),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  })
  .openapi('UpdateProductRequest')
