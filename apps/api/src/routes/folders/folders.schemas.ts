import { z } from '@hono/zod-openapi'

import { Cuid2Schema, NullableCuid2Schema, TimestampSchema } from '../../schemas/common.js'

export const FolderSchema = z.object({
  id: Cuid2Schema,
  parentId: NullableCuid2Schema,
  name: z.string(),
  itemCount: z.number().int().nonnegative(),
  processingItemCount: z.number().int().nonnegative(),
  totalSizeBytes: z.number().int().nonnegative(),
  thumbnailUrls: z.array(z.url()).max(4),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).openapi('Folder')

export const FolderListResponseSchema = z.object({
  data: z.array(FolderSchema),
}).openapi('FolderListResponse')

export const FolderParamsSchema = z.object({ id: Cuid2Schema })

export const CreateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: NullableCuid2Schema.optional(),
}).openapi('CreateFolderRequest')

export const UpdateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  parentId: NullableCuid2Schema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('UpdateFolderRequest')
