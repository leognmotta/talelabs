/** Public API contracts for lightweight direct Create sessions. */

import { z } from '@hono/zod-openapi'

import {
  Cuid2Schema,
  CursorSchema,
  PaginationLimitSchema,
  TimestampSchema,
} from '../../schemas/common.js'

/** One durable Create session identity. */
export const CreateSessionSchema = z.object({
  createdAt: TimestampSchema,
  id: Cuid2Schema,
  name: z.string().nullable(),
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
})

/** User-authored Create session name. */
export const RenameCreateSessionRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
}).openapi('RenameCreateSessionRequest')
