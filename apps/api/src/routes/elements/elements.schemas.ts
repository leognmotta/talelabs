/** Request and response contracts for the Elements API. */

import { z } from '@hono/zod-openapi'
import { ELEMENT_KINDS, MAX_ELEMENT_REFERENCES } from '@talelabs/assets'

import {
  AssetLifecycleSchema,
  AssetProcessingStateSchema,
  AssetTypeSchema,
  createListResponseSchema,
  Cuid2Schema,
  CursorSchema,
  PaginationLimitSchema,
  TimestampSchema,
} from '../../schemas/common.js'

/** Presentation-only Element kind label. */
export const ElementKindSchema = z.enum(ELEMENT_KINDS).openapi('ElementKind')

/** One reference Asset as presented inside Element responses. */
export const ElementReferenceAssetSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  type: AssetTypeSchema,
  mimeType: z.string(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  lifecycle: AssetLifecycleSchema,
  processingState: AssetProcessingStateSchema,
  url: z.url().nullable(),
  thumbnailUrl: z.url().nullable(),
  createdAt: TimestampSchema,
}).openapi('ElementReferenceAsset')

/** Element list/summary representation with derived count and cover. */
export const ElementSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  kind: ElementKindSchema,
  description: z.string(),
  referenceCount: z.number().int().nonnegative(),
  coverAsset: ElementReferenceAssetSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).openapi('Element')

/** Element with its complete ordered reference list. */
export const ElementDetailSchema = ElementSchema.extend({
  references: z.array(ElementReferenceAssetSchema)
    .max(MAX_ELEMENT_REFERENCES),
}).openapi('ElementDetail')

/** Cursor page of Elements. */
export const ElementListResponseSchema = createListResponseSchema(ElementSchema)
  .openapi('ElementListResponse')

/** Path parameter carrying one Element ID. */
export const ElementParamsSchema = z.object({ id: Cuid2Schema })

/** List filters, page size, and cursor. */
export const ElementListQuerySchema = z.object({
  kind: ElementKindSchema.optional(),
  search: z.string().trim().max(200).optional(),
  assetId: Cuid2Schema.optional(),
  limit: PaginationLimitSchema,
  cursor: CursorSchema.optional(),
})

/** Bounded list of reference Asset IDs. */
const ElementReferenceIdsSchema = z.array(Cuid2Schema)
  .max(MAX_ELEMENT_REFERENCES)

/** Create payload; references are optional and applied transactionally. */
export const CreateElementRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: ElementKindSchema,
  description: z.string().trim().max(2_000).optional(),
  assetIds: ElementReferenceIdsSchema.optional(),
}).openapi('CreateElementRequest')

/** Update payload; `assetIds` replaces the full ordered list when sent. */
export const UpdateElementRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: ElementKindSchema.optional(),
  description: z.string().trim().max(2_000).optional(),
  assetIds: ElementReferenceIdsSchema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('UpdateElementRequest')

/** Atomic add/remove payload for capture flows and their Undo. */
export const MutateElementReferencesRequestSchema = z.object({
  add: ElementReferenceIdsSchema.optional(),
  remove: ElementReferenceIdsSchema.optional(),
}).refine(value => (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0, {
  message: 'Provide Assets to add or remove',
}).refine((value) => {
  const removeSet = new Set(value.remove ?? [])
  return !(value.add ?? []).some(id => removeSet.has(id))
}, { message: 'An Asset cannot be both added and removed', path: ['add'] }).openapi('MutateElementReferencesRequest')

/** Mutation response: the detail plus exactly which Assets changed. */
export const ElementReferenceMutationSchema = ElementDetailSchema.extend({
  addedAssetIds: z.array(Cuid2Schema),
  removedAssetIds: z.array(Cuid2Schema),
}).openapi('ElementReferenceMutation')
