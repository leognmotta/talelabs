import { z } from '@hono/zod-openapi'
import { ListQuerySchema, ResourceIdSchema } from '../../schemas/common.js'

export const ProjectSchema = z.object({
  id: ResourceIdSchema,
  name: z.string(),
  description: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).openapi('Project')

export const ProjectIdParamsSchema = z.object({
  projectId: ResourceIdSchema,
})

export const ListProjectsQuerySchema = ListQuerySchema

export const ListProjectsResponseSchema = z.object({
  data: z.array(ProjectSchema),
  nextCursor: z.string().nullable(),
}).openapi('ListProjectsResponse')

export const CreateProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
}).openapi('CreateProjectRequest')

export const UpdateProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required.',
}).openapi('UpdateProjectRequest')
