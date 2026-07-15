import { z } from '@hono/zod-openapi'

import {
  AssetLifecycleSchema,
  AssetProcessingStateSchema,
  AssetSourceSchema,
  AssetTypeSchema,
  AssetVisibilitySchema,
  createListResponseSchema,
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  PaginationLimitSchema,
  SortOrderSchema,
  TimestampSchema,
  UserIdSchema,
} from '../../schemas/common.js'
import {
  ElementReferenceKindSchema,
  ElementReferenceMetadataSchema,
} from '../../schemas/element-reference.js'
import { TagSchema } from '../tags/tags.schemas.js'

const NullableTimestampSchema = z.iso.datetime().nullable()

export const AssetSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  type: AssetTypeSchema,
  source: AssetSourceSchema,
  visibility: AssetVisibilitySchema,
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  folderId: NullableCuid2Schema,
  generationJobId: NullableCuid2Schema,
  outputIndex: z.number().int().nonnegative().nullable(),
  lifecycle: AssetLifecycleSchema,
  processingState: AssetProcessingStateSchema,
  processingError: z.string().nullable(),
  favorite: z.boolean(),
  tags: z.array(TagSchema),
  url: z.url().nullable(),
  thumbnailUrl: z.url().nullable(),
  createdBy: UserIdSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).openapi('Asset')

export const GenerationJobSourceSchema = z.object({
  sortOrder: z.number().int().nonnegative(),
  sourceType: z.enum(['text', 'element', 'asset', 'nodeOutput']),
  nodeId: Cuid2Schema,
  elementId: NullableCuid2Schema,
  assetId: NullableCuid2Schema,
  resolvedText: z.string().nullable(),
  snapshot: z.record(z.string(), z.any()),
}).openapi('GenerationJobSource')

export const GenerationProvenanceSchema = z.object({
  jobId: Cuid2Schema,
  runId: Cuid2Schema,
  mediaType: z.enum(['image', 'video', 'audio']),
  provider: z.string(),
  model: z.string(),
  settings: z.record(z.string(), z.any()),
  resolvedPrompt: z.string().nullable(),
  creditCost: z.number().int().nullable(),
  sources: z.array(GenerationJobSourceSchema),
  inputs: z.array(z.object({
    assetId: Cuid2Schema,
    role: z.string(),
    sortOrder: z.number().int().nonnegative(),
  })),
  createdAt: TimestampSchema,
  completedAt: NullableTimestampSchema,
}).openapi('GenerationProvenance')

export const AssetDetailSchema = AssetSchema.extend({
  metadata: z.record(z.string(), z.any()),
  elementLinks: z.array(z.object({
    elementId: Cuid2Schema,
    role: z.string(),
    isPrimary: z.boolean(),
    referenceKind: ElementReferenceKindSchema,
    referenceMetadata: ElementReferenceMetadataSchema,
  })),
  generation: GenerationProvenanceSchema.nullable(),
  usedAsInputCount: z.number().int().nonnegative(),
}).openapi('AssetDetail')

export const AssetListResponseSchema = createListResponseSchema(AssetSchema)
  .openapi('AssetListResponse')

export const AssetParamsSchema = z.object({ id: Cuid2Schema })

export const AssetTagParamsSchema = AssetParamsSchema.extend({
  tagId: Cuid2Schema,
})

export const AssetListQuerySchema = z.object({
  type: z.union([AssetTypeSchema, z.array(AssetTypeSchema)]).optional(),
  source: AssetSourceSchema.optional(),
  folderId: z.union([Cuid2Schema, z.literal('root')]).optional(),
  elementId: Cuid2Schema.optional(),
  role: z.string().trim().min(1).max(64).optional(),
  favorite: z.stringbool().optional().openapi({ type: 'boolean' }),
  tagId: z.union([Cuid2Schema, z.array(Cuid2Schema)]).optional(),
  search: z.string().trim().max(200).optional(),
  archived: z.stringbool().default(false).openapi({ type: 'boolean' }),
  sort: z.enum(['createdAt', 'name', 'sizeBytes']).default('createdAt'),
  order: SortOrderSchema.default('desc'),
  limit: PaginationLimitSchema,
  cursor: CursorSchema.optional(),
}).refine(value => !value.role || value.elementId, {
  message: 'elementId is required when filtering by role',
  path: ['elementId'],
})

export const RegisterAssetRequestSchema = z.object({
  uploadId: z.string().min(1).max(8192),
  name: z.string().trim().min(1).max(255).optional(),
  folderId: Cuid2Schema.optional(),
  elementId: Cuid2Schema.optional(),
  role: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isPrimary: z.boolean().optional(),
  referenceKind: ElementReferenceKindSchema.optional(),
  referenceMetadata: ElementReferenceMetadataSchema.optional(),
}).refine(value => !value.role || Boolean(value.elementId), {
  message: 'elementId is required when role is provided',
  path: ['elementId'],
}).refine(value => value.role || (
  value.sortOrder === undefined
  && value.isPrimary === undefined
  && value.referenceKind === undefined
  && value.referenceMetadata === undefined
), {
  message: 'role is required for Element link metadata',
  path: ['role'],
}).openapi('RegisterAssetRequest')

export const UpdateAssetRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  folderId: NullableCuid2Schema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('UpdateAssetRequest')

export const MoveAssetsRequestSchema = z.object({
  assetIds: z.array(Cuid2Schema)
    .min(1)
    .max(100)
    .refine(ids => new Set(ids).size === ids.length, {
      message: 'Asset IDs must be unique',
    }),
  folderId: NullableCuid2Schema,
}).openapi('MoveAssetsRequest')

export const MoveAssetsResponseSchema = z.object({
  data: z.array(AssetSchema),
}).openapi('MoveAssetsResponse')

export const AssetUsageSchema = z.object({
  jobId: Cuid2Schema,
  runId: Cuid2Schema,
  role: z.string(),
  createdAt: TimestampSchema,
}).openapi('AssetUsage')

export const AssetUsageListResponseSchema = createListResponseSchema(AssetUsageSchema)
  .openapi('AssetUsageListResponse')

export const AssetUsageQuerySchema = z.object({
  limit: PaginationLimitSchema,
  cursor: CursorSchema.optional(),
})

export const AssetDownloadResponseSchema = z.object({
  url: z.url(),
}).openapi('AssetDownloadResponse')
