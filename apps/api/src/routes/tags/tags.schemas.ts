import { z } from '@hono/zod-openapi'

import { Cuid2Schema, TimestampSchema } from '../../schemas/common.js'

export const TagSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).openapi('Tag')

export const TagListResponseSchema = z.object({
  data: z.array(TagSchema),
}).openapi('TagListResponse')

export const TagParamsSchema = z.object({ id: Cuid2Schema })

export const CreateTagRequestSchema = z.object({
  name: z.string().trim().min(1).max(48),
}).openapi('CreateTagRequest')
