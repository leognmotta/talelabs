import { z } from '@hono/zod-openapi'
import { ListQuerySchema, ResourceIdSchema } from '../../schemas/common.js'

export const CharacterSchema = z
  .object({
    id: ResourceIdSchema,
    name: z.string(),
    role: z.string().nullable(),
    description: z.string().nullable(),
    personality: z.string().nullable(),
    visualNotes: z.string().nullable(),
    brandIds: z.array(z.string()),
    createdBy: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Character')
export const CharacterDetailSchema = CharacterSchema.extend({
  kitCounts: z.record(z.string(), z.number()),
}).openapi('CharacterDetail')
export const CharacterIdParamsSchema = z.object({
  characterId: ResourceIdSchema,
})
export const BrandCharacterParamsSchema = z.object({
  brandId: ResourceIdSchema,
  characterId: ResourceIdSchema,
})
export const BrandIdParamsSchema = z.object({ brandId: ResourceIdSchema })
export const ListCharactersQuerySchema = ListQuerySchema.extend({
  brandId: ResourceIdSchema.optional(),
})
export const ListCharactersResponseSchema = z
  .object({ data: z.array(CharacterSchema), nextCursor: z.string().nullable() })
  .openapi('ListCharactersResponse')
export const BrandCharactersResponseSchema = z
  .object({
    data: z.array(CharacterSchema),
  })
  .openapi('BrandCharactersResponse')
const fields = {
  name: z.string().trim().min(1).max(160),
  role: z.string().trim().max(160),
  description: z.string().trim().max(4000),
  personality: z.string().trim().max(4000),
  visualNotes: z.string().trim().max(4000),
}
export const CreateCharacterRequestSchema = z
  .object({
    name: fields.name,
    role: fields.role.optional(),
    description: fields.description.optional(),
    personality: fields.personality.optional(),
    visualNotes: fields.visualNotes.optional(),
    brandIds: z.array(ResourceIdSchema).max(100).optional(),
  })
  .openapi('CreateCharacterRequest')
export const UpdateCharacterRequestSchema = z
  .object({
    name: fields.name.optional(),
    role: fields.role.nullable().optional(),
    description: fields.description.nullable().optional(),
    personality: fields.personality.nullable().optional(),
    visualNotes: fields.visualNotes.nullable().optional(),
    brandIds: z.array(ResourceIdSchema).max(100).optional(),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  })
  .openapi('UpdateCharacterRequest')
export const LinkBrandCharacterRequestSchema = z
  .object({ characterId: ResourceIdSchema })
  .openapi('LinkBrandCharacterRequest')
export const BrandCharacterLinkSchema = z
  .object({ brandId: z.string(), characterId: z.string() })
  .openapi('BrandCharacterLink')
