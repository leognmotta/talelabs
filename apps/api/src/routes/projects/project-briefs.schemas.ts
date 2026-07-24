/** OpenAPI contracts for Project Brief documents and entity mentions. */

import { z } from '@hono/zod-openapi'

import {
  AssetTypeSchema,
  Cuid2Schema,
  NullableTimestampSchema,
  PaginationLimitSchema,
  UserIdSchema,
} from '../../schemas/common.js'

/** Entity families supported by navigational Brief mentions. */
export const ProjectMentionTypeSchema = z.enum([
  'asset',
  'element',
  'flow',
  'folder',
  'session',
]).openapi('ProjectMentionType')

/** Stable structured mention identity embedded in Tiptap JSON. */
export const ProjectMentionSchema = z.object({
  entityId: Cuid2Schema,
  entityType: ProjectMentionTypeSchema,
  fallbackLabel: z.string().trim().min(1).max(120),
}).openapi('ProjectMention')

/** Current or unavailable presentation resolved for one mention. */
export const ProjectMentionResolutionSchema = z.object({
  asset: z.object({
    height: z.number().int().positive().nullable(),
    type: AssetTypeSchema,
    width: z.number().int().positive().nullable(),
  }).nullable(),
  available: z.boolean(),
  entityId: Cuid2Schema,
  entityType: ProjectMentionTypeSchema,
  label: z.string(),
  thumbnailUrl: z.url().nullable(),
}).openapi('ProjectMentionResolution')

/** One authoritative Brief read with batched mention metadata. */
export const ProjectBriefSchema = z.object({
  document: z.record(z.string(), z.any()),
  mentions: z.array(ProjectMentionResolutionSchema).max(200),
  plainText: z.string(),
  revision: z.number().int().nonnegative(),
  updatedAt: NullableTimestampSchema,
  updatedBy: UserIdSchema.nullable(),
}).openapi('ProjectBrief')

/** Compare-and-set Brief autosave payload. */
export const SaveProjectBriefRequestSchema = z.object({
  document: z.record(z.string(), z.any()),
  expectedRevision: z.number().int().nonnegative(),
}).openapi('SaveProjectBriefRequest')

/** One bounded set of references to batch-resolve. */
export const ResolveProjectMentionsRequestSchema = z.object({
  mentions: z.array(ProjectMentionSchema)
    .max(200)
    .refine((mentions) => {
      const keys = mentions.map(item => `${item.entityType}:${item.entityId}`)
      return new Set(keys).size === keys.length
    }, { message: 'Mention identities must be unique' }),
}).openapi('ResolveProjectMentionsRequest')

/** Batch mention-resolution response. */
export const ResolveProjectMentionsResponseSchema = z.object({
  data: z.array(ProjectMentionResolutionSchema).max(200),
}).openapi('ResolveProjectMentionsResponse')

/** Search input for the Project-scoped @ suggestion menu. */
export const ProjectMentionSearchQuerySchema = z.object({
  limit: PaginationLimitSchema.pipe(z.number().max(20)).default(8),
  search: z.string().trim().max(200).default(''),
})

/** One grouped mention suggestion section. */
export const ProjectMentionGroupSchema = z.object({
  entityType: ProjectMentionTypeSchema,
  items: z.array(ProjectMentionResolutionSchema),
}).openapi('ProjectMentionGroup')

/** Grouped Project mention suggestions returned behind one endpoint. */
export const ProjectMentionSearchResponseSchema = z.object({
  groups: z.array(ProjectMentionGroupSchema).length(5),
}).openapi('ProjectMentionSearchResponse')
