/** Public OpenAPI schemas for Flow run commands, state, and outputs. */

import { z } from '@hono/zod-openapi'
import {
  BROWSER_RUN_MAX_OUTPUT_BYTES,
  BrowserRunManifestSchema,
  BrowserRunClaimResponseSchema as RuntimeBrowserRunClaimResponseSchema,
} from '@talelabs/flows'

import {
  AssetVisibilitySchema,
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  PaginationLimitSchema,
  TimestampSchema,
} from '../../schemas/common.js'

/** Supported Flow graph-selection modes. */
export const FlowRunModeSchema = z.enum([
  'node',
  'downstream',
  'upstream',
  'selection',
  'all',
])

/** Provider execution mode selected for a run. */
export const FlowRunExecutionModeSchema = z.enum(['live', 'debug'])

/** Environment responsible for provider lifecycle execution. */
export const FlowRunExecutionRuntimeSchema = z.enum(['managed', 'browser'])

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
  })
  .openapi('FlowRunPlanRequest')

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
    mode: FlowRunModeSchema,
    expectedFlowRevision: z.number().int().nonnegative(),
    targetNodeId: Cuid2Schema.optional(),
    selectedNodeIds: z.array(Cuid2Schema).min(1).max(100).optional(),
  })
  .openapi('CreateRunRequest')

/** Flow-scoped run request whose Flow ID is supplied by the route. */
export const CreateFlowRunRequestSchema = CreateRunRequestSchema.omit({
  flowId: true,
}).openapi('CreateFlowRunRequest')

/** Bounded planning summary returned before run admission. */
export const FlowRunPlanResponseSchema = z
  .object({
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
    visibility: AssetVisibilitySchema,
    jobId: Cuid2Schema,
    mimeType: z.string(),
    outputIndex: z.number().int().nonnegative(),
    thumbnailUrl: z.url().nullable(),
    type: z.enum(['image', 'video', 'audio', 'document']),
    url: z.url().nullable(),
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
  })
  .openapi('FlowRunJob')

/** Materialized runtime item belonging to one Flow node. */
export const FlowRunNodeItemSchema = z
  .object({
    nodeId: Cuid2Schema,
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
    nodeId: Cuid2Schema,
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
  })
  .openapi('FlowRun')

/** Short-lived Trigger.dev realtime token scoped to one run. */
export const RunRealtimeTokenSchema = z
  .object({
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
    nodeCounts: z.record(z.string(), z.number().int().nonnegative()),
  })
  .openapi('FlowRunSummary')

/** Cursor-paginated filters for Flow run history. */
export const RunListQuerySchema = z.object({
  browserWork: z.enum(['pending']).optional(),
  cursor: CursorSchema.optional(),
  executionRuntime: FlowRunExecutionRuntimeSchema.optional(),
  flowId: Cuid2Schema.optional(),
  limit: PaginationLimitSchema,
  scope: z.enum(['all', 'mine']).default('all'),
  status: FlowRunStatusSchema.optional(),
})

/** Cursor-paginated Flow run history response. */
export const RunListResponseSchema = z
  .object({
    data: z.array(FlowRunSummarySchema),
    nextCursor: z.string().nullable(),
  })
  .openapi('RunListResponse')

/** Browser executor identity scoped to one tab and lease. */
export const BrowserExecutorSchema = z.object({
  executorId: z.string().min(16).max(200),
})

/** Current PostgreSQL lease generation required by every fenced operation. */
export const BrowserLeaseActorSchema = BrowserExecutorSchema.extend({
  fenceToken: z.number().int().positive(),
})

/** URL-query form of the current lease generation. */
export const BrowserLeaseQuerySchema = BrowserExecutorSchema.extend({
  fenceToken: z.coerce.number().int().positive(),
})

/** Browser lease response used for acquisition and heartbeat renewal. */
export const BrowserRunLeaseSchema = z.object({
  executorId: z.string(),
  fenceToken: z.number().int().positive(),
  leaseExpiresAt: TimestampSchema,
})

/** Bounded claim request for dependency-ready browser jobs. */
export const BrowserRunClaimRequestSchema = BrowserLeaseActorSchema.extend({
  activeJobIds: z.array(Cuid2Schema).max(4).default([]),
  limit: z.number().int().min(1).max(4).default(2),
})

/** Runtime-validated private claim response; never contains credentials. */
export const BrowserRunClaimResponseSchema
  = RuntimeBrowserRunClaimResponseSchema

/** Strict authoritative browser recovery manifest response. */
export const BrowserRunManifestResponseSchema = BrowserRunManifestSchema

/** Opens the one-shot provider-submission boundary for a fenced browser job. */
export const BrowserBeginSubmissionRequestSchema = BrowserLeaseActorSchema

/** One-shot submission boundary timestamps bounded by the current lease. */
export const BrowserBeginSubmissionResponseSchema = z.object({
  submissionExpiresAt: TimestampSchema,
  submittedAt: TimestampSchema,
})

/** Persists asynchronous identity and unverified browser-reported facts. */
export const BrowserJobCheckpointRequestSchema = BrowserLeaseActorSchema.extend(
  {
    facts: z
      .object({
        providerCostUsd: z.number().nonnegative().optional(),
        providerGenerationId: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    providerJobId: z.string().min(1).optional(),
  },
)

/** Acknowledges the durable provider-processing checkpoint. */
export const BrowserJobCheckpointResponseSchema = z.object({
  checkpointedAt: TimestampSchema,
})

/** Exact object-upload grant request for one planned media output. */
export const BrowserOutputGrantRequestSchema = BrowserLeaseActorSchema.extend({
  contentLength: z.number().int().positive().max(BROWSER_RUN_MAX_OUTPUT_BYTES),
  contentMd5: z
    .base64()
    .length(24)
    .refine(value => value.endsWith('=='))
    .optional(),
  mimeType: z.string().min(1).max(255),
  outputIndex: z.number().int().nonnegative(),
})

/** Short-lived browser upload target with no durable recovery fields. */
export const BrowserOutputGrantSchema = z.object({
  alreadyUploaded: z.boolean(),
  expiresAt: NullableTimestampSchema,
  headers: z.record(z.string(), z.string()),
  uploadUrl: z.url().nullable(),
})

/** Canonical media finalization request after direct upload verification. */
export const BrowserFinalizeMediaRequestSchema = BrowserLeaseActorSchema.extend(
  {
    metadata: z
      .record(
        z.string().min(1).max(100),
        z.union([z.boolean(), z.number(), z.string().max(2_000)]),
      )
      .refine(value => Object.keys(value).length <= 64)
      .optional(),
    mimeType: z.string().min(1).max(255),
    outputIndex: z.number().int().nonnegative(),
  },
)

/** Canonical text finalization request for one planned output. */
export const BrowserFinalizeTextRequestSchema = BrowserLeaseActorSchema.extend({
  outputIndex: z.number().int().nonnegative(),
  text: z.string().max(1_000_000),
})

/** Browser job completion request carrying only safe accounting facts. */
export const BrowserCompleteJobRequestSchema = BrowserLeaseActorSchema.extend({
  facts: z
    .object({
      providerCostUsd: z.number().nonnegative().optional(),
      providerGenerationId: z.string().min(1).optional(),
    })
    .strict()
    .optional(),
})

/** Allowlisted browser failure without raw provider text or credentials. */
export const BrowserFailJobRequestSchema = BrowserLeaseActorSchema.extend({
  code: z.enum([
    'invalid_job_request',
    'invalid_snapshot',
    'generation_failed',
    'provider_authentication',
    'provider_insufficient_balance',
    'provider_rate_limited',
    'provider_rejected',
    'provider_response_invalid',
    'provider_submission_uncertain',
    'provider_timeout',
    'provider_unavailable',
    'run_execution_failed',
  ]),
  retryAfterMs: z.number().int().positive().max(300_000).optional(),
  safeToResubmit: z.boolean().optional(),
})

/** Parameters for a job nested under its owning run. */
export const BrowserRunJobParamsSchema = RunParamsSchema.extend({
  jobId: Cuid2Schema,
})

/** Idempotent output persistence and canonical processing result. */
export const BrowserFinalizeOutputResponseSchema = z.object({
  state: z.enum(['canceled', 'processing', 'succeeded']),
})

/** Browser job completion or durable Asset-processing result. */
export const BrowserCompleteJobResponseSchema = z.object({
  state: z.enum(['canceled', 'processing', 'succeeded']),
})

/** Retry, cancellation, supersession, or terminal failure result for a browser job. */
export const BrowserFailJobResponseSchema = z.union([
  z.object({ failed: z.literal(true) }),
  z.object({ state: z.literal('canceled') }),
  z.object({ nextEligibleAt: TimestampSchema, state: z.literal('retrying') }),
  z.object({ state: z.literal('superseded') }),
])

/** Safe provider-cancellation outcome reported by a browser executor. */
export const BrowserCancellationRequestSchema = BrowserLeaseActorSchema.extend({
  final: z.boolean(),
  result: z.enum(['accepted', 'rejected', 'unavailable', 'unsupported']),
})

/** Authoritative cancellation reconciliation state. */
export const BrowserCancellationResponseSchema = z.object({
  cancellationReconciled: z.boolean(),
  state: z.literal('canceled'),
})

/** Stable non-secret browser executor conditions presented to the run owner. */
export const BrowserExecutorCodeSchema = z.enum([
  'browser_api_unavailable',
  'browser_authorization_failed',
  'browser_executor_failed',
  'browser_journal_unavailable',
  'browser_locks_unavailable',
  'browser_manifest_invalid',
  'browser_run_not_found',
  'credential_required',
  'credential_store_unavailable',
  'provider_cancellation_pending',
])

/** Authoritative browser executor state update without raw error text. */
export const BrowserExecutorStatusRequestSchema = z.object({
  code: BrowserExecutorCodeSchema.nullable(),
  status: z.enum(['blocked', 'canceling', 'error', 'ready', 'retrying']),
})

/** Persisted safe browser executor status returned to the owning user. */
export const BrowserExecutorStatusResponseSchema
  = BrowserExecutorStatusRequestSchema.extend({
    updatedAt: TimestampSchema,
  })
