/** Shared API schemas: ids, cursors, pagination, and error envelopes. */

import { z } from '@hono/zod-openapi'
import { isCuid } from '@paralleldrive/cuid2'

/** A cuid2 identifier. */
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
/** A nullable cuid2 identifier, kept inline for OpenAPI generator compatibility. */
export const NullableCuid2Schema = z.string()
  .regex(/^[a-z][0-9a-z]+$/)
  .min(2)
  .max(32)
  .nullable()

/** An opaque user identifier. */
export const UserIdSchema = z.string()
  .min(1)
  .max(255)
  .openapi('UserId', { example: 'user_123' })

/** An ISO-8601 UTC timestamp. */
export const TimestampSchema = z.iso.datetime().openapi('Timestamp', {
  example: '2026-07-10T12:00:00.000Z',
})

/** An opaque pagination cursor from a prior list response. */
export const CursorSchema = z.string().trim().min(1).max(2048).openapi('Cursor', {
  description: 'Opaque cursor returned by a previous list response',
})

/** Page size, 1–200, defaulting to 50. */
export const PaginationLimitSchema = z.coerce.number()
  .int()
  .min(1)
  .max(200)
  .default(50)
  .openapi('PaginationLimit', {
    example: 50,
  })

/** Ascending or descending sort order. */
export const SortOrderSchema = z.enum(['asc', 'desc']).openapi('SortOrder', {
  example: 'desc',
})

/** Standard cursor/limit/order pagination query. */
export const PaginationQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PaginationLimitSchema,
  order: SortOrderSchema.optional(),
}).openapi('PaginationQuery')

/** Generatable media family. */
export const MediaTypeSchema = z.enum([
  'image',
  'video',
  'audio',
]).openapi('MediaType')

/** Asset media type, including non-generatable documents. */
export const AssetTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'document',
]).openapi('AssetType')

/** How an Asset originated: user upload or generation output. */
export const AssetSourceSchema = z.enum([
  'upload',
  'generation',
]).openapi('AssetSource')

/** Asset storage visibility. */
export const AssetVisibilitySchema = z.enum([
  'private',
  'public',
]).openapi('AssetVisibility')

/** Asset lifecycle state from live through purged. */
export const AssetLifecycleSchema = z.enum([
  'live',
  'archived',
  'purging',
  'purged',
]).openapi('AssetLifecycle')

/** Ingestion processing state of an Asset. */
export const AssetProcessingStateSchema = z.enum([
  'processing',
  'ready',
  'failed',
]).openapi('AssetProcessingState')

/** Flow run command scope. */
export const RunModeSchema = z.enum([
  'node',
  'downstream',
  'all',
  'tool',
]).openapi('RunMode')

/** Aggregate status of a Flow run. */
export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'partial',
  'failed',
  'canceled',
]).openapi('RunStatus')

/** Status of one generation job. */
export const JobStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'canceled',
]).openapi('JobStatus')

/** Stable machine-readable product error codes clients may translate. */
export const ProductErrorCodeSchema = z.enum([
  'validation_error',
  'unauthenticated',
  'active_organization_required',
  'organization_context_changed',
  'not_found',
  'conflict',
  'asset_not_available',
  'element_reference_limit_reached',
  'element_reference_not_image',
  'revision_conflict',
  'invalid_state',
  'unsupported_by_model',
  'rate_limited',
  'insufficient_credits',
  'internal_error',
]).openapi('ProductErrorCode')

/** One field-level error detail with a stable code and params. */
export const ErrorDetailSchema = z.object({
  code: z.string(),
  field: z.string(),
  message: z.string(),
  params: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ).optional(),
}).openapi('ErrorDetail')

/** Standard error envelope for API responses. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().openapi({ example: 'validation_error' }),
    message: z.string().openapi({ example: 'The request could not be validated.' }),
    details: z.array(ErrorDetailSchema).optional(),
  }),
}).openapi('ErrorResponse')

/** Alias for a resource cuid2 id. */
export const ResourceIdSchema = Cuid2Schema

/** Wraps an item schema in the standard `{ data, nextCursor }` list envelope. */
export function createListResponseSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().trim().min(1).max(2048).nullable(),
  })
}
