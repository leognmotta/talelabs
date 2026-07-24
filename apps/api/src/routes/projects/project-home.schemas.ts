/** OpenAPI response contract for the compact bounded Project Home. */

import { z } from '@hono/zod-openapi'

import {
  NullableTimestampSchema,
  TimestampSchema,
} from '../../schemas/common.js'
import { AssetSchema } from '../assets/assets.schemas.js'
import { ProjectSchema } from './projects.schemas.js'

/** First useful Brief blocks rendered without duplicating the full editor. */
export const ProjectBriefPreviewSchema = z.object({
  document: z.record(z.string(), z.any()),
  empty: z.boolean(),
  revision: z.number().int().nonnegative(),
  updatedAt: NullableTimestampSchema,
}).openapi('ProjectBriefPreview')

/** One recent resumable Flow or Create session. */
export const ProjectRecentWorkSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  outputCount: z.number().int().nonnegative(),
  type: z.enum(['flow', 'session']),
  updatedAt: TimestampSchema,
}).openapi('ProjectRecentWork')

/** Compact Project orientation payload with bounded media and work sets. */
export const ProjectHomeSchema = z.object({
  brief: ProjectBriefPreviewSchema,
  project: ProjectSchema,
  recentAssets: z.array(AssetSchema).max(10),
  recentWork: z.array(ProjectRecentWorkSchema).max(8),
}).openapi('ProjectHome')
