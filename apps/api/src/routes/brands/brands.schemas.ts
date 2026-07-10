import { z } from '@hono/zod-openapi'
import { ListQuerySchema, ResourceIdSchema } from '../../schemas/common.js'

export const BrandColorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Use a six-digit hex color.'),
}).openapi('BrandColor')

export const BrandSchema = z.object({
  id: ResourceIdSchema,
  name: z.string(),
  description: z.string().nullable(),
  toneOfVoice: z.string().nullable(),
  visualStyle: z.string().nullable(),
  doRules: z.string().nullable(),
  dontRules: z.string().nullable(),
  colors: z.array(BrandColorSchema),
  createdBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).openapi('Brand')

export const BrandDetailSchema = BrandSchema.extend({
  kitCounts: z.record(z.string(), z.number()),
}).openapi('BrandDetail')

export const BrandIdParamsSchema = z.object({ brandId: ResourceIdSchema })
export const ListBrandsQuerySchema = ListQuerySchema
export const ListBrandsResponseSchema = z.object({
  data: z.array(BrandSchema),
  nextCursor: z.string().nullable(),
}).openapi('ListBrandsResponse')

const brandFields = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000),
  toneOfVoice: z.string().trim().max(4000),
  visualStyle: z.string().trim().max(4000),
  doRules: z.string().trim().max(8000),
  dontRules: z.string().trim().max(8000),
  colors: z.array(BrandColorSchema).max(24),
}

export const CreateBrandRequestSchema = z.object({
  name: brandFields.name,
  description: brandFields.description.optional(),
  toneOfVoice: brandFields.toneOfVoice.optional(),
  visualStyle: brandFields.visualStyle.optional(),
  doRules: brandFields.doRules.optional(),
  dontRules: brandFields.dontRules.optional(),
  colors: brandFields.colors.optional(),
}).openapi('CreateBrandRequest')

export const UpdateBrandRequestSchema = z.object({
  name: brandFields.name.optional(),
  description: brandFields.description.nullable().optional(),
  toneOfVoice: brandFields.toneOfVoice.nullable().optional(),
  visualStyle: brandFields.visualStyle.nullable().optional(),
  doRules: brandFields.doRules.nullable().optional(),
  dontRules: brandFields.dontRules.nullable().optional(),
  colors: brandFields.colors.optional(),
}).refine(value => Object.keys(value).length > 0, { message: 'At least one field is required.' }).openapi('UpdateBrandRequest')
