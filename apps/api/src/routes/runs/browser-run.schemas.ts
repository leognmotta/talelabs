/** Public OpenAPI contracts for the fenced browser execution runtime. */

import { z } from '@hono/zod-openapi'
import {
  BROWSER_RUN_MAX_OUTPUT_BYTES,
  BrowserRunManifestSchema,
  BrowserRunClaimResponseSchema as RuntimeBrowserRunClaimResponseSchema,
} from '@talelabs/flows'

import { Cuid2Schema, TimestampSchema } from '../../schemas/common.js'
import { RunParamsSchema } from './runs.schemas.js'

const NullableTimestampSchema = z.iso.datetime().nullable()

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
