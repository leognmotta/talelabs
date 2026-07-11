import { z } from '@hono/zod-openapi'
import { isCuid } from '@paralleldrive/cuid2'

export const Cuid2Schema = z.string()
  .refine(value => isCuid(value), { message: 'Invalid cuid2 identifier' })
  .openapi('Cuid2', {
    example: 'tz4a98xxat96iws9zmbrgj3a',
    maxLength: 32,
    minLength: 2,
    pattern: '^[a-z][0-9a-z]+$',
  })

// Keep nullable IDs inline in OpenAPI. Referencing Cuid2 and then applying
// nullable produces an allOf shape that some generators cannot emit correctly.
export const NullableCuid2Schema = z.string()
  .regex(/^[a-z][0-9a-z]+$/)
  .min(2)
  .max(32)
  .nullable()

export const UserIdSchema = z.string()
  .min(1)
  .max(255)
  .openapi('UserId', { example: 'user_123' })

export const TimestampSchema = z.iso.datetime().openapi('Timestamp', {
  example: '2026-07-10T12:00:00.000Z',
})

export const CursorSchema = z.string().trim().min(1).max(2048).openapi('Cursor', {
  description: 'Opaque cursor returned by a previous list response',
})

export const PaginationLimitSchema = z.coerce.number()
  .int()
  .min(1)
  .max(200)
  .default(50)
  .openapi('PaginationLimit', {
    example: 50,
  })

export const SortOrderSchema = z.enum(['asc', 'desc']).openapi('SortOrder', {
  example: 'desc',
})

export const PaginationQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PaginationLimitSchema,
  order: SortOrderSchema.optional(),
}).openapi('PaginationQuery')

export const MediaTypeSchema = z.enum([
  'image',
  'video',
  'audio',
]).openapi('MediaType')

export const AssetTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'document',
]).openapi('AssetType')

export const AssetSourceSchema = z.enum([
  'upload',
  'generation',
]).openapi('AssetSource')

export const AssetLifecycleSchema = z.enum([
  'live',
  'archived',
  'purging',
  'purged',
]).openapi('AssetLifecycle')

export const AssetProcessingStateSchema = z.enum([
  'processing',
  'ready',
  'failed',
]).openapi('AssetProcessingState')

export const RunModeSchema = z.enum([
  'node',
  'downstream',
  'all',
  'tool',
]).openapi('RunMode')

export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'partial',
  'failed',
  'canceled',
]).openapi('RunStatus')

export const JobStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'canceled',
]).openapi('JobStatus')

export const ProductErrorCodeSchema = z.enum([
  'validation_error',
  'unauthenticated',
  'active_organization_required',
  'organization_context_changed',
  'not_found',
  'conflict',
  'asset_not_available',
  'element_asset_already_attached',
  'element_asset_media_type_not_accepted',
  'element_asset_role_capacity_reached',
  'element_asset_role_not_found',
  'revision_conflict',
  'invalid_state',
  'unsupported_by_model',
  'rate_limited',
  'insufficient_credits',
  'internal_error',
]).openapi('ProductErrorCode')

export const ErrorDetailSchema = z.object({
  code: z.string(),
  field: z.string(),
  message: z.string(),
  params: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ).optional(),
}).openapi('ErrorDetail')

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().openapi({ example: 'validation_error' }),
    message: z.string().openapi({ example: 'The request could not be validated.' }),
    details: z.array(ErrorDetailSchema).optional(),
  }),
}).openapi('ErrorResponse')

export const ResourceIdSchema = Cuid2Schema

export function createListResponseSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().trim().min(1).max(2048).nullable(),
  })
}
