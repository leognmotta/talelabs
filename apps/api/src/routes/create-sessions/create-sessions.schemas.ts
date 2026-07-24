/** Public API contracts for lightweight direct Create sessions. */

import { z } from '@hono/zod-openapi'

import {
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  PaginationLimitSchema,
  TimestampSchema,
} from '../../schemas/common.js'

/** One durable Create session identity. */
export const CreateSessionSchema = z.object({
  assetFolderId: NullableCuid2Schema,
  createdAt: TimestampSchema,
  id: Cuid2Schema,
  name: z.string().nullable(),
  projectId: NullableCuid2Schema,
  updatedAt: TimestampSchema,
}).openapi('CreateSession')

/** Opaque cursor page of owned Create sessions. */
export const CreateSessionListResponseSchema = z.object({
  data: z.array(CreateSessionSchema),
  nextCursor: z.string().nullable(),
}).openapi('CreateSessionListResponse')

/** Route parameter carrying one Create session ID. */
export const CreateSessionParamsSchema = z.object({ id: Cuid2Schema })

/** Search and pagination filters for the session rail. */
export const CreateSessionListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PaginationLimitSchema,
  search: z.string().trim().max(200).optional(),
  projectId: z.union([Cuid2Schema, z.literal('private')]).optional(),
})

/** User-authored Create session name. */
export const RenameCreateSessionRequestSchema = z.object({
  assetFolderId: NullableCuid2Schema.optional(),
  name: z.string().trim().min(1).max(120).optional(),
  projectId: NullableCuid2Schema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('RenameCreateSessionRequest')
