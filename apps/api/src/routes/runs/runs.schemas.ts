/** Public OpenAPI schemas for Flow run commands, state, and outputs. */

import { z } from '@hono/zod-openapi'
import { PromptTemplateSchema } from '@talelabs/flows'

import {
  AssetVisibilitySchema,
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  TimestampSchema,
} from '../../schemas/common.js'
import {
  FlowRunExecutionModeSchema,
  FlowRunExecutionRuntimeSchema,
  FlowRunFundingSourceSchema,
  FlowRunModeSchema,
  RunModeSchema,
  RunSourceSchema,
} from './run-admission.schemas.js'

export {
  CreateDirectRunRequestSchema,
  EstimateDirectRunRequestSchema,
  FlowRunExecutionModeSchema,
  FlowRunExecutionRuntimeSchema,
  FlowRunFundingSourceSchema,
  FlowRunModeSchema,
  RunModeSchema,
  RunSourceSchema,
} from './run-admission.schemas.js'

/** Durable Flow run lifecycle statuses. */
export const FlowRunStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'partial',
  'failed',
  'canceled',
])

/** Durable per-node execution statuses. */
export const FlowRunNodeStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'partial',
  'failed',
  'skipped',
  'canceled',
])

/** Durable generation-job lifecycle statuses. */
export const GenerationJobStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'canceled',
])

/** Output media types supported by generation jobs. */
export const GenerationJobMediaTypeSchema = z.enum([
  'image',
  'video',
  'audio',
  'text',
])

const NullableTimestampSchema = z.iso.datetime().nullable()

/** Route parameters for a run resource. */
export const RunParamsSchema = z.object({ id: Cuid2Schema })
/** Route parameters for admitting a run from a Flow. */
export const FlowRunParamsSchema = z.object({ flowId: Cuid2Schema })

const BaseRunCommandSchema = z.object({
  expectedFlowRevision: z.number().int().nonnegative(),
})

/** Graph-selection command accepted by Flow planning. */
export const FlowRunCommandRequestSchema = z
  .discriminatedUnion('mode', [
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
  ])
  .openapi('FlowRunCommandRequest')

/** Request body for previewing a Flow run plan. */
export const FlowRunPlanRequestSchema = z
  .object({
    command: FlowRunCommandRequestSchema,
    executionMode: FlowRunExecutionModeSchema.default('live'),
    executionRuntime: FlowRunExecutionRuntimeSchema.default('managed'),
    fundingSource: z.literal('credits'),
  })
  .openapi('FlowRunPlanRequest')

/** Public advisory cost estimate shared by Flow and direct run admission. */
export const RunCostEstimateSchema = z.discriminatedUnion('status', [
  z.object({
    amountUsd: z.string().regex(/^\d+(?:\.\d+)?$/),
    currency: z.literal('USD'),
    estimatedJobCount: z.number().int().nonnegative(),
    status: z.literal('estimated'),
    unavailableJobCount: z.literal(0),
  }),
  z.object({
    amountUsd: z.null(),
    currency: z.literal('USD'),
    estimatedJobCount: z.number().int().nonnegative(),
    status: z.literal('partial'),
    unavailableJobCount: z.number().int().positive(),
  }),
  z.object({
    amountUsd: z.null(),
    currency: z.literal('USD'),
    estimatedJobCount: z.literal(0),
    status: z.literal('unavailable'),
    unavailableJobCount: z.number().int().nonnegative(),
  }),
]).openapi('RunCostEstimate')

/** Request body for admitting a tenant-scoped Flow run. */
export const CreateRunRequestSchema = z
  .object({
    executionMode: FlowRunExecutionModeSchema.default('live'),
    executionRuntime: FlowRunExecutionRuntimeSchema.default('managed'),
    expectedPlanHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
    flowId: Cuid2Schema,
    fundingSource: FlowRunFundingSourceSchema,
    mode: FlowRunModeSchema,
    expectedFlowRevision: z.number().int().nonnegative(),
    targetNodeId: Cuid2Schema.optional(),
    selectedNodeIds: z.array(Cuid2Schema).min(1).max(100).optional(),
    byokProviders: z.array(z.enum(['fal', 'openrouter'])).max(8).optional(),
  })
  .openapi('CreateRunRequest')

/** Flow-scoped run request whose Flow ID is supplied by the route. */
export const CreateFlowRunRequestSchema = CreateRunRequestSchema.omit({
  flowId: true,
}).openapi('CreateFlowRunRequest')

/** Direct Create estimate response derived from a compiled execution plan. */
export const DirectRunEstimateResponseSchema = z.object({
  costEstimate: RunCostEstimateSchema,
  executionPlanHash: z.string(),
  expectedOutputCount: z.number().int().positive(),
  plannedJobCount: z.number().int().positive(),
}).openapi('DirectRunEstimateResponse')

/** Bounded planning summary returned before run admission. */
export const FlowRunPlanResponseSchema = z
  .object({
    costEstimate: RunCostEstimateSchema,
    flowId: Cuid2Schema,
    flowRevision: z.number().int().nonnegative(),
    planHash: z.string(),
    expectedOutputCount: z.number().int().nonnegative(),
    plannedExecutableCount: z.number().int().nonnegative(),
    plannedItemCount: z.number().int().nonnegative(),
    plannedJobCount: z.number().int().nonnegative(),
    requestedExecutableCount: z.number().int().nonnegative(),
    topologicalDepth: z.number().int().nonnegative(),
  })
  .openapi('FlowRunPlanResponse')

/** Canonical Asset output produced by a generation job. */
export const FlowRunAssetOutputSchema = z
  .object({
    assetId: Cuid2Schema,
    durationSeconds: z.number().nonnegative().nullable(),
    height: z.number().int().positive().nullable(),
    visibility: AssetVisibilitySchema,
    jobId: Cuid2Schema,
    mimeType: z.string(),
    outputIndex: z.number().int().nonnegative(),
    thumbnailUrl: z.url().nullable(),
    type: z.enum(['image', 'video', 'audio', 'document']),
    url: z.url().nullable(),
    width: z.number().int().positive().nullable(),
  })
  .openapi('FlowRunAssetOutput')

/** Persisted text output produced by a generation job. */
export const FlowRunTextOutputSchema = z
  .object({
    jobId: Cuid2Schema,
    outputIndex: z.number().int().nonnegative(),
    text: z.string(),
  })
  .openapi('FlowRunTextOutput')

/** Durable generation-job representation exposed by run reads. */
export const FlowRunJobSchema = z
  .object({
    id: Cuid2Schema,
    nodeId: z.string().min(1).max(200),
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
  })
  .openapi('FlowRunJob')

/** Materialized runtime item belonging to one Flow node. */
export const FlowRunNodeItemSchema = z
  .object({
    nodeId: z.string().min(1).max(200),
    itemKey: z.string(),
    sortOrder: z.number().int().nonnegative(),
    status: FlowRunNodeStatusSchema,
    dimensions: z.record(z.string(), z.any()),
    lineage: z.array(z.any()),
  })
  .openapi('FlowRunNodeItem')

/** Durable execution state for one Flow node. */
export const FlowRunNodeStateSchema = z
  .object({
    nodeId: z.string().min(1).max(200),
    status: FlowRunNodeStatusSchema,
    items: z.array(FlowRunNodeItemSchema),
    jobs: z.array(FlowRunJobSchema),
  })
  .openapi('FlowRunNodeState')

/** Detailed durable Flow run API representation. */
export const FlowRunSchema = z
  .object({
    id: Cuid2Schema,
    browserExecution: z
      .object({
        code: z.string().nullable(),
        status: z.enum(['ready', 'blocked', 'retrying', 'error', 'canceling']),
        updatedAt: NullableTimestampSchema,
      })
      .nullable(),
    executionMode: FlowRunExecutionModeSchema,
    executionRuntime: FlowRunExecutionRuntimeSchema,
    createSessionId: NullableCuid2Schema,
    flowId: NullableCuid2Schema,
    mode: RunModeSchema,
    source: RunSourceSchema,
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
  })
  .openapi('FlowRun')

/** Short-lived Trigger.dev realtime token scoped to one run. */
export const RunRealtimeTokenSchema = z
  .object({
    flowId: NullableCuid2Schema,
    source: RunSourceSchema,
    triggerRunId: z.string(),
    publicAccessToken: z.string(),
    expiresAt: TimestampSchema,
  })
  .openapi('RunRealtimeToken')

/** Optional constraints and execution-mode override for a run retry. */
export const RetryRunRequestSchema = z
  .object({
    executionMode: FlowRunExecutionModeSchema.optional(),
    executionRuntime: FlowRunExecutionRuntimeSchema.optional(),
    expectedRunStatus: FlowRunStatusSchema.optional(),
  })
  .openapi('RetryRunRequest')

/** Compact Flow run representation used by history lists. */
export const FlowRunSummarySchema = FlowRunSchema.omit({ nodes: true })
  .extend({
    assetOutputs: z.array(FlowRunAssetOutputSchema),
    assetOutputsTruncated: z.boolean(),
    nodeCounts: z.record(z.string(), z.number().int().nonnegative()),
    requestSummary: z
      .object({
        inline: z.record(z.string(), z.string().max(16_000)),
        inputs: z.array(z.object({
          assetIds: z.array(Cuid2Schema).max(32),
          mediaTypes: z.array(z.enum(['audio', 'image', 'video'])).max(32),
          slotId: z.string().min(1).max(100),
        })).max(16),
        mediaType: GenerationJobMediaTypeSchema,
        modelId: z.string().min(1).max(200),
        modelContractVersion: z.string().min(1).max(100),
        nodeType: z.string().min(1).max(100),
        operationId: z.string().min(1).max(100),
        outputCount: z.number().int().positive(),
        promptTemplates: z.record(z.string(), PromptTemplateSchema),
        settings: z.record(
          z.string(),
          z.union([z.boolean(), z.number().finite(), z.string()]),
        ),
      })
      .nullable(),
  })
  .openapi('FlowRunSummary')

/** Cursor-paginated filters for Flow run history. */
export const RunListQuerySchema = z.object({
  createSessionId: Cuid2Schema.optional(),
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
  source: RunSourceSchema.default('flow'),
  flowId: Cuid2Schema.optional(),
}).superRefine((value, context) => {
  if (value.source === 'flow' && !value.flowId) {
    context.addIssue({
      code: 'custom',
      message: 'flowId is required for Flow history.',
      path: ['flowId'],
    })
  }
  if (value.source === 'create' && value.flowId) {
    context.addIssue({
      code: 'custom',
      message: 'flowId is not accepted for Create history.',
      path: ['flowId'],
    })
  }
  if (value.source === 'create' && !value.createSessionId) {
    context.addIssue({
      code: 'custom',
      message: 'createSessionId is required for Create history.',
      path: ['createSessionId'],
    })
  }
  if (value.source === 'flow' && value.createSessionId) {
    context.addIssue({
      code: 'custom',
      message: 'createSessionId is not accepted for Flow history.',
      path: ['createSessionId'],
    })
  }
})

/** Cursor-paginated Flow run history response. */
export const RunListResponseSchema = z
  .object({
    data: z.array(FlowRunSummarySchema),
    nextCursor: z.string().nullable(),
  })
  .openapi('RunListResponse')

/** Filters for bounded active-run discovery without history presentation. */
export const ActiveRunListQuerySchema = z.object({
  executionRuntime: FlowRunExecutionRuntimeSchema,
  scope: z.enum(['all', 'mine']).default('all'),
  source: RunSourceSchema.optional(),
})

/** Lean active-run identity used by realtime and browser recovery. */
export const ActiveRunListItemSchema = z.object({
  createSessionId: NullableCuid2Schema,
  executionRuntime: FlowRunExecutionRuntimeSchema,
  flowId: NullableCuid2Schema,
  id: Cuid2Schema,
  source: RunSourceSchema,
  status: FlowRunStatusSchema,
})

/** Bounded active-run discovery response with no snapshots or output media. */
export const ActiveRunListResponseSchema = z
  .object({ data: z.array(ActiveRunListItemSchema).max(200) })
  .openapi('ActiveRunListResponse')
