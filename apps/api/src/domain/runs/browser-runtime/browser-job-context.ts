/** Shared fenced job validation for browser transitions and output ingestion. */

import type { Database, Transaction } from '@talelabs/db'
import type { BrowserRunLeaseContext } from './browser-runtime-policy.js'

import { readFlowRunJobRequestPayload } from '@talelabs/flows'
import {
  assertJobMatchesSnapshotExecutionContract,
  discardCanceledGenerationResult,
} from '@talelabs/trigger'

import { HttpError, TenantResourceNotFoundError } from '../../../middleware/error.js'
import { withBrowserRunLease } from './browser-runtime-policy.js'

/** Identity shared by every fenced mutation of one claimed browser job. */
export interface BrowserJobActor {
  /** Tab-scoped executor that owns the current lease. */
  executorId: string
  /** Monotonic lease generation attached to the job claim. */
  fenceToken: number
  /** Persisted job being mutated. */
  jobId: string
  /** Tenant that owns the run and job. */
  organizationId: string
  /** Durable browser run containing the job. */
  runId: string
  /** Authenticated run creator. */
  userId: string
}

async function requireBrowserJob(
  input: BrowserJobActor,
  run: BrowserRunLeaseContext,
  trx: Transaction<Database>,
) {
  const job = await trx.selectFrom('generationJobs')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.runId)
    .where('id', '=', input.jobId)
    .executeTakeFirst()
  if (!job)
    throw new TenantResourceNotFoundError()
  if (job.browserFenceToken !== input.fenceToken)
    throw new HttpError(409, 'browser_run_lease_lost', 'Browser job ownership is no longer active.')
  const contract = run.artifact.snapshot.executionContracts.find(
    candidate => candidate.nodeId === job.nodeId,
  )
  if (!contract)
    throw new HttpError(409, 'invalid_snapshot', 'The browser run snapshot is invalid.')
  assertJobMatchesSnapshotExecutionContract({
    contract,
    job,
    requestPayload: readFlowRunJobRequestPayload({
      requestHash: job.requestHash,
      requestPayload: job.requestPayload,
    }),
  })
  return { artifact: run.artifact, job, run, trx }
}

/** Holds the current lease fence while validating and mutating one claimed job. */
export async function withBrowserJob<Result>(
  input: BrowserJobActor,
  operation: (context: Awaited<ReturnType<typeof requireBrowserJob>>) => Promise<Result>,
) {
  return withBrowserRunLease(input, async (run, trx) => (
    operation(await requireBrowserJob(input, run, trx))
  ))
}

/** Discards late results and leaves submitted provider settlement unresolved. */
export async function finalizeCanceledBrowserJob(input: {
  job: Awaited<ReturnType<typeof requireBrowserJob>>['job']
  organizationId: string
  runId: string
  trx: Transaction<Database>
}) {
  const providerWasSubmitted = input.job.providerSubmittedAt !== null
  await input.trx.updateTable('generationJobs').set({
    providerSettlementResolvedAt: providerWasSubmitted ? new Date() : null,
    providerSettlementStatus: providerWasSubmitted ? 'unknown' : 'not_required',
  }).where('organizationId', '=', input.organizationId).where('id', '=', input.job.id).execute()
  await discardCanceledGenerationResult({
    flowRunId: input.runId,
    jobId: input.job.id,
    organizationId: input.organizationId,
  }, input.trx)
  return { state: 'canceled' as const }
}
