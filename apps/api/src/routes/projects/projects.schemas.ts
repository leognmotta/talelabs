/** OpenAPI contracts for Project CRUD and grouped organization summaries. */

import { z } from '@hono/zod-openapi'

import {
  AssetTypeSchema,
  createListResponseSchema,
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  NullableTimestampSchema,
  PaginationLimitSchema,
  TimestampSchema,
} from '../../schemas/common.js'

/** Grouped counts used by Project lists and the contextual sidebar. */
export const ProjectCountsSchema = z.object({
  assets: z.number().int().nonnegative(),
  createSessions: z.number().int().nonnegative(),
  elements: z.number().int().nonnegative(),
  flows: z.number().int().nonnegative(),
  folders: z.number().int().nonnegative(),
}).openapi('ProjectCounts')

/** Bounded cover presentation without loading the original media object. */
export const ProjectCoverAssetSchema = z.object({
  id: Cuid2Schema,
  mimeType: z.string(),
  thumbnailUrl: z.url().nullable(),
  type: AssetTypeSchema,
}).openapi('ProjectCoverAsset')

/** One Project identity with optional location defaults and grouped counts. */
export const ProjectSchema = z.object({
  archivedAt: NullableTimestampSchema,
  counts: ProjectCountsSchema,
  coverAsset: ProjectCoverAssetSchema.nullable(),
  coverAssetId: NullableCuid2Schema,
  createdAt: TimestampSchema,
  defaultAssetFolderId: NullableCuid2Schema,
  description: z.string(),
  id: Cuid2Schema,
  name: z.string(),
  updatedAt: TimestampSchema,
}).openapi('Project')

/** Cursor page of Projects. */
export const ProjectListResponseSchema = createListResponseSchema(ProjectSchema)
  .openapi('ProjectListResponse')

/** Project list filters and stable page cursor. */
export const ProjectListQuerySchema = z.object({
  archive: z.enum(['active', 'archived', 'all']).default('active'),
  cursor: CursorSchema.optional(),
  limit: PaginationLimitSchema,
  search: z.string().trim().min(1).max(200).optional(),
})

/** Path parameter carrying one Project ID. */
export const ProjectParamsSchema = z.object({ projectId: Cuid2Schema })

/** Minimal Project creation payload. */
export const CreateProjectRequestSchema = z.object({
  description: z.string().trim().max(500).default(''),
  name: z.string().trim().min(1).max(120),
}).openapi('CreateProjectRequest')

/** Editable Project metadata and same-Project Asset targets. */
export const UpdateProjectRequestSchema = z.object({
  coverAssetId: NullableCuid2Schema.optional(),
  defaultAssetFolderId: NullableCuid2Schema.optional(),
  description: z.string().trim().max(500).optional(),
  name: z.string().trim().min(1).max(120).optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('UpdateProjectRequest')
