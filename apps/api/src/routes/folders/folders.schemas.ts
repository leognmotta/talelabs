/** OpenAPI contracts for Project-aware Asset folder operations. */

import { z } from '@hono/zod-openapi'

import { Cuid2Schema, NullableCuid2Schema, TimestampSchema } from '../../schemas/common.js'

/** Presented folder metadata with direct and recursive content aggregates. */
export const FolderSchema = z.object({
  assetCount: z.number().int().nonnegative(),
  childFolderCount: z.number().int().nonnegative(),
  id: Cuid2Schema,
  parentId: NullableCuid2Schema,
  name: z.string(),
  itemCount: z.number().int().nonnegative(),
  processingItemCount: z.number().int().nonnegative(),
  projectId: NullableCuid2Schema,
  totalSizeBytes: z.number().int().nonnegative(),
  thumbnailUrls: z.array(z.url()).max(4),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).openapi('Folder')

/** Complete bounded folder metadata set for one scope. */
export const FolderListResponseSchema = z.object({
  data: z.array(FolderSchema),
}).openapi('FolderListResponse')

/** Minimal Project folder row for contextual hierarchy navigation. */
export const ProjectFolderTreeItemSchema = z.object({
  assetCount: z.number().int().nonnegative(),
  id: Cuid2Schema,
  name: z.string(),
  parentId: NullableCuid2Schema,
}).openapi('ProjectFolderTreeItem')

/** Complete bounded compact folder tree for one Project. */
export const ProjectFolderTreeResponseSchema = z.object({
  data: z.array(ProjectFolderTreeItemSchema),
}).openapi('ProjectFolderTreeResponse')

/** Route identity for one folder. */
export const FolderParamsSchema = z.object({ id: Cuid2Schema })

/** Optional Project or Private filter for the flat folder list. */
export const FolderListQuerySchema = z.object({
  projectId: z.union([Cuid2Schema, z.literal('private')]).optional(),
})

/** Required Project scope for the compact contextual tree. */
export const ProjectFolderTreeQuerySchema = z.object({
  projectId: Cuid2Schema,
})

/** Validated folder creation payload and optional location. */
export const CreateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: NullableCuid2Schema.optional(),
  projectId: NullableCuid2Schema.optional(),
}).openapi('CreateFolderRequest')

/** Validated folder rename or atomic Project/parent move payload. */
export const UpdateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  parentId: NullableCuid2Schema.optional(),
  projectId: NullableCuid2Schema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('UpdateFolderRequest')
