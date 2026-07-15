import { z } from '@hono/zod-openapi'

import {
  AssetVisibilitySchema,
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  PaginationLimitSchema,
  TimestampSchema,
} from '../../schemas/common.js'

export const FlowRunModeSchema = z.enum([
  'node',
  'downstream',
  'upstream',
  'selection',
  'all',
])

export const FlowRunStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'partial',
  'failed',
  'canceled',
])

export const FlowRunNodeStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'partial',
  'failed',
  'skipped',
  'canceled',
])

export const GenerationJobStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'canceled',
])

export const GenerationJobMediaTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'text',
])

const NullableTimestampSchema = z.iso.datetime().nullable()

export const RunParamsSchema = z.object({ id: Cuid2Schema })
export const FlowRunParamsSchema = z.object({ flowId: Cuid2Schema })

const BaseRunCommandSchema = z.object({
  expectedFlowRevision: z.number().int().nonnegative(),
})

export const FlowRunCommandRequestSchema = z.discriminatedUnion('mode', [
  BaseRunCommandSchema.extend({
    mode: z.literal('node'),
    targetNodeId: Cuid2Schema,
  }),
  BaseRunCommandSchema.extend({
    mode: z.literal('downstream'),
    targetNodeId: Cuid2Schema,
  }),
  BaseRunCommandSchema.extend({
    mode: z.literal('upstream'),
    targetNodeId: Cuid2Schema,
  }),
  BaseRunCommandSchema.extend({
    mode: z.literal('selection'),
    selectedNodeIds: z.array(Cuid2Schema).min(1).max(100),
  }),
  BaseRunCommandSchema.extend({
    mode: z.literal('all'),
  }),
]).openapi('FlowRunCommandRequest')

export const FlowRunPlanRequestSchema = z.object({
  command: FlowRunCommandRequestSchema,
}).openapi('FlowRunPlanRequest')

export const CreateRunRequestSchema = z.object({
  expectedPlanHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  flowId: Cuid2Schema,
  mode: FlowRunModeSchema,
  expectedFlowRevision: z.number().int().nonnegative(),
  targetNodeId: Cuid2Schema.optional(),
  selectedNodeIds: z.array(Cuid2Schema).min(1).max(100).optional(),
}).openapi('CreateRunRequest')

export const CreateFlowRunRequestSchema = CreateRunRequestSchema.omit({
  flowId: true,
}).openapi('CreateFlowRunRequest')

export const FlowRunPlanResponseSchema = z.object({
  flowId: Cuid2Schema,
  flowRevision: z.number().int().nonnegative(),
  planHash: z.string(),
  expectedOutputCount: z.number().int().nonnegative(),
  plannedExecutableCount: z.number().int().nonnegative(),
  plannedItemCount: z.number().int().nonnegative(),
  plannedJobCount: z.number().int().nonnegative(),
  requestedExecutableCount: z.number().int().nonnegative(),
  topologicalDepth: z.number().int().nonnegative(),
}).openapi('FlowRunPlanResponse')

export const FlowRunAssetOutputSchema = z.object({
  assetId: Cuid2Schema,
  visibility: AssetVisibilitySchema,
  jobId: Cuid2Schema,
  mimeType: z.string(),
  outputIndex: z.number().int().nonnegative(),
  thumbnailUrl: z.url().nullable(),
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.url().nullable(),
}).openapi('FlowRunAssetOutput')

export const FlowRunTextOutputSchema = z.object({
  jobId: Cuid2Schema,
  outputIndex: z.number().int().nonnegative(),
  text: z.string(),
}).openapi('FlowRunTextOutput')

export const FlowRunJobSchema = z.object({
  id: Cuid2Schema,
  nodeId: Cuid2Schema,
  itemKey: z.string(),
  requestIndex: z.number().int().nonnegative(),
  mediaType: GenerationJobMediaTypeSchema,
  status: GenerationJobStatusSchema,
  model: z.string(),
  operation: z.string(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  assetOutputs: z.array(FlowRunAssetOutputSchema),
  textOutputs: z.array(FlowRunTextOutputSchema),
}).openapi('FlowRunJob')

export const FlowRunNodeItemSchema = z.object({
  nodeId: Cuid2Schema,
  itemKey: z.string(),
  sortOrder: z.number().int().nonnegative(),
  status: FlowRunNodeStatusSchema,
  dimensions: z.record(z.string(), z.any()),
  lineage: z.array(z.any()),
}).openapi('FlowRunNodeItem')

export const FlowRunNodeStateSchema = z.object({
  nodeId: Cuid2Schema,
  status: FlowRunNodeStatusSchema,
  items: z.array(FlowRunNodeItemSchema),
  jobs: z.array(FlowRunJobSchema),
}).openapi('FlowRunNodeState')

export const FlowRunSchema = z.object({
  id: Cuid2Schema,
  flowId: NullableCuid2Schema,
  mode: FlowRunModeSchema,
  targetNodeId: NullableCuid2Schema,
  status: FlowRunStatusSchema,
  planHash: z.string(),
  snapshotHash: z.string(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: TimestampSchema,
  startedAt: NullableTimestampSchema,
  completedAt: NullableTimestampSchema,
  summary: z.object({
    expectedOutputCount: z.number().int().nonnegative(),
    plannedExecutableCount: z.number().int().nonnegative(),
    plannedItemCount: z.number().int().nonnegative(),
    plannedJobCount: z.number().int().nonnegative(),
  }),
  nodes: z.array(FlowRunNodeStateSchema),
}).openapi('FlowRun')

export const RunRealtimeTokenSchema = z.object({
  triggerRunId: z.string(),
  publicAccessToken: z.string(),
  expiresAt: TimestampSchema,
}).openapi('RunRealtimeToken')

export const RetryRunRequestSchema = z.object({
  expectedRunStatus: FlowRunStatusSchema.optional(),
}).openapi('RetryRunRequest')

export const FlowRunSummarySchema = FlowRunSchema.omit({ nodes: true }).extend({
  nodeCounts: z.record(z.string(), z.number().int().nonnegative()),
}).openapi('FlowRunSummary')

export const RunListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  flowId: Cuid2Schema.optional(),
  limit: PaginationLimitSchema,
  status: FlowRunStatusSchema.optional(),
})

export const RunListResponseSchema = z.object({
  data: z.array(FlowRunSummarySchema),
  nextCursor: z.string().nullable(),
}).openapi('RunListResponse')
