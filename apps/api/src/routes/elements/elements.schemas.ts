import { z } from '@hono/zod-openapi'
import { ELEMENT_TYPES } from '@talelabs/elements'

import {
  createListResponseSchema,
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  PaginationLimitSchema,
  TimestampSchema,
  UserIdSchema,
} from '../../schemas/common.js'
import {
  ElementReferenceKindSchema,
  ElementReferenceMetadataSchema,
} from '../../schemas/element-reference.js'
import { AssetSchema } from '../assets/assets.schemas.js'

export const ElementTypeSchema = z.enum(ELEMENT_TYPES)
  .openapi('ElementType')

export const ElementDataSchema = z.record(z.string(), z.any())
  .openapi('ElementData')

export const ElementSchema = z.object({
  id: Cuid2Schema,
  type: ElementTypeSchema,
  name: z.string(),
  assetFolderId: NullableCuid2Schema,
  instructions: z.string().nullable(),
  data: ElementDataSchema,
  schemaVersion: z.number().int().positive(),
  createdBy: UserIdSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).openapi('Element')

export const ElementReadinessSchema = z.object({
  state: z.enum(['empty', 'usable', 'strong']),
  missing: z.array(z.string()).max(32),
  recommendations: z.array(z.string()).max(32),
}).openapi('ElementReadiness')

export const CreatedElementSchema = z.object({
  ...ElementSchema.shape,
  assetFolderId: Cuid2Schema,
}).openapi('CreatedElement')

export const ElementListItemSchema = ElementSchema.extend({
  hasProcessingReferences: z.boolean(),
  previewThumbnailUrl: z.url().nullable(),
  readiness: ElementReadinessSchema,
}).openapi('ElementListItem')

export const ElementListResponseSchema = createListResponseSchema(ElementListItemSchema)
  .openapi('ElementListResponse')

export const ElementDetailSchema = ElementSchema.extend({
  assetCounts: z.record(z.string(), z.number().int().nonnegative()),
  readiness: ElementReadinessSchema,
}).openapi('ElementDetail')

export const ElementListQuerySchema = z.object({
  type: ElementTypeSchema.optional(),
  search: z.string().trim().max(200).optional(),
  limit: PaginationLimitSchema,
  cursor: CursorSchema.optional(),
})

export const ElementParamsSchema = z.object({ id: Cuid2Schema })

export const CreateElementRequestSchema = z.object({
  type: ElementTypeSchema,
  name: z.string().trim().min(1).max(255),
  instructions: z.string().trim().max(10_000).optional(),
  data: ElementDataSchema.optional(),
}).openapi('CreateElementRequest')

export const UpdateElementRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  instructions: z.string().trim().max(10_000).nullable().optional(),
  data: ElementDataSchema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('UpdateElementRequest')

export const ElementAssetLinkSchema = z.object({
  assetId: Cuid2Schema,
  role: z.string().min(1).max(64),
  sortOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
  referenceKind: ElementReferenceKindSchema,
  referenceMetadata: ElementReferenceMetadataSchema,
  asset: AssetSchema,
}).openapi('ElementAssetLink')

export const ElementAssetListResponseSchema = createListResponseSchema(ElementAssetLinkSchema)
  .openapi('ElementAssetListResponse')

export const ElementAssetListQuerySchema = z.object({
  role: z.string().trim().min(1).max(64).optional(),
  referenceKind: ElementReferenceKindSchema.optional(),
})

export const CreateElementAssetRequestSchema = z.object({
  assetId: Cuid2Schema,
  role: z.string().trim().min(1).max(64),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().default(false),
  referenceKind: ElementReferenceKindSchema.default('master'),
  referenceMetadata: ElementReferenceMetadataSchema.default({}),
}).openapi('CreateElementAssetRequest')

export const ElementAssetParamsSchema = ElementParamsSchema.extend({
  assetId: Cuid2Schema,
})

export const UpdateElementAssetRequestSchema = z.object({
  role: z.string().trim().min(1).max(64),
  targetRole: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
  referenceKind: ElementReferenceKindSchema.optional(),
  referenceMetadata: ElementReferenceMetadataSchema.optional(),
}).refine(value =>
  value.targetRole !== undefined
  || value.sortOrder !== undefined
  || value.isPrimary !== undefined
  || value.referenceKind !== undefined
  || value.referenceMetadata !== undefined, {
  message: 'At least one mutable field is required',
}).openapi('UpdateElementAssetRequest')

export const DeleteElementAssetQuerySchema = z.object({
  role: z.string().trim().min(1).max(64),
})

export const ElementUsageFlowSchema = z.object({
  flowId: Cuid2Schema,
  flowName: z.string(),
  nodeCount: z.number().int().nonnegative(),
}).openapi('ElementUsageFlow')

export const ElementUsageSchema = z.object({
  flowCount: z.number().int().nonnegative(),
  flows: z.array(ElementUsageFlowSchema).max(20),
  runCount: z.number().int().nonnegative(),
  lastUsedAt: z.iso.datetime().nullable(),
}).openapi('ElementUsage')
