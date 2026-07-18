/** Fenced browser provider submission, retry, failure, and completion transitions. */

import type { SafeRunFailureCode } from '@talelabs/trigger'

import { sql } from '@talelabs/db'
import { readFlowRunExecutionMode } from '@talelabs/flows'
import {
  aggregateFlowRunState,
  markJobFailed,
  skipDescendants,
  toSafeRunFailure,
} from '@talelabs/trigger'

import { HttpError } from '../../../middleware/error.js'
import {
  finalizeCanceledBrowserJob,
  withBrowserJob,
} from './browser-job-context.js'
import { retireBrowserRunLeaseIfTerminal } from './browser-lease.service.js'
import {
  readBrowserJobOutputReadiness,
  settleReadyBrowserJob,
} from './browser-output-readiness.service.js'
import {
  BROWSER_JOB_DEFAULT_RETRY_MS,
  BROWSER_JOB_MAX_ATTEMPTS,
  BROWSER_JOB_MAX_RETRY_MS,
} from './browser-runtime-policy.js'

/** Opens the one-shot submission boundary for the currently fenced job claim. */
export async function beginBrowserJobSubmission(input: {
  executorId: string
  fenceToken: number
  jobId: string
  organizationId: string
  runId: string
  userId: string
}) {
  return withBrowserJob(input, async ({ job, run, trx }) => {
    if (
      job.browserSubmissionState !== 'not_started'
      || job.providerSubmittedAt
    ) {
      throw new HttpError(
        409,
        'provider_submission_uncertain',
        'Provider submission cannot be repeated safely.',
      )
    }
    const now = new Date()
    const started = await trx
      .updateTable('generationJobs')
      .set({
        browserSubmissionState: 'submitting',
        providerSettlementResolvedAt: null,
        providerSettlementStatus: 'pending',
        providerSubmittedAt: now,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.jobId)
      .where('browserFenceToken', '=', input.fenceToken)
      .where('browserSubmissionState', '=', 'not_started')
      .where('providerSubmittedAt', 'is', null)
      .where('status', '=', 'running')
      .returning('id')
      .executeTakeFirst()
    if (!started) {
      throw new HttpError(
        409,
        'provider_submission_uncertain',
        'Provider submission cannot be repeated safely.',
      )
    }
    return {
      submissionExpiresAt: run.leaseExpiresAt.toISOString(),
      submittedAt: now.toISOString(),
    }
  })
}

/** Persists only untrusted browser facts and a recoverable provider job ID. */
export async function checkpointBrowserJob(input: {
  executorId: string
  facts?: { providerCostUsd?: number, providerGenerationId?: string }
  fenceToken: number
  jobId: string
  organizationId: string
  providerJobId?: string
  runId: string
  userId: string
}) {
  return withBrowserJob(input, async ({ job, run, trx }) => {
    const now = new Date()
    const canceled = run.status === 'canceled' || job.status === 'canceled'
    const checkpointed = await trx
      .updateTable('generationJobs')
      .set({
        browserReportedProviderCostUsd:
          input.facts?.providerCostUsd ?? job.browserReportedProviderCostUsd,
        browserReportedProviderGenerationId:
          input.facts?.providerGenerationId
          ?? job.browserReportedProviderGenerationId,
        browserSubmissionState: job.providerSubmittedAt
          ? 'submitted'
          : job.browserSubmissionState,
        providerJobId: input.providerJobId ?? job.providerJobId,
        providerSettlementResolvedAt: canceled
          ? job.providerSettlementResolvedAt
          : null,
        providerSettlementStatus: canceled
          ? job.providerSettlementStatus
          : job.providerSubmittedAt
            ? 'pending'
            : 'not_required',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.jobId)
      .where('browserFenceToken', '=', input.fenceToken)
      .where('status', '=', canceled ? 'canceled' : 'running')
      .returning('id')
      .executeTakeFirst()
    if (!checkpointed) {
      throw new HttpError(
        409,
        'invalid_state',
        'The browser job no longer accepts checkpoints.',
      )
    }
    return { checkpointedAt: now.toISOString() }
  })
}

/** Completes a job only after every planned output has canonical persistence. */
export async function completeBrowserJob(input: {
  executorId: string
  facts?: { providerCostUsd?: number, providerGenerationId?: string }
  fenceToken: number
  jobId: string
  organizationId: string
  runId: string
  userId: string
}) {
  const result = await withBrowserJob(
    input,
    async ({ artifact, job, run, trx }) => {
      const outputReadiness = await readBrowserJobOutputReadiness(job, trx)
      if (outputReadiness === 'incomplete') {
        throw new HttpError(
          409,
          'browser_outputs_incomplete',
          'Not all browser outputs are finalized.',
        )
      }
      if (run.status === 'canceled') {
        return finalizeCanceledBrowserJob({
          job,
          organizationId: input.organizationId,
          runId: input.runId,
          trx,
        })
      }
      if (outputReadiness === 'processing')
        return { state: 'processing' as const }
      if (outputReadiness === 'failed') {
        throw new HttpError(
          409,
          'browser_output_processing_failed',
          'A browser output could not be processed.',
        )
      }
      const executionMode = readFlowRunExecutionMode(
        artifact.snapshot.executionMode,
      )
      return settleReadyBrowserJob({
        executionMode,
        facts: input.facts,
        job,
        trx,
      })
    },
  )
  await retireBrowserRunLeaseIfTerminal(input)
  return result
}

/** Fails one job with a stable code, skips descendants, and recomputes aggregation. */
export async function failBrowserJob(input: {
  code: SafeRunFailureCode
  executorId: string
  fenceToken: number
  jobId: string
  organizationId: string
  retryAfterMs?: number
  runId: string
  safeToResubmit?: boolean
  userId: string
}) {
  const result = await withBrowserJob(
    input,
    async ({ artifact, job, run, trx }) => {
      if (run.status === 'canceled') {
        return finalizeCanceledBrowserJob({
          job,
          organizationId: input.organizationId,
          runId: input.runId,
          trx,
        })
      }
      const retryDelayMs = Math.min(
        Math.max(input.retryAfterMs ?? BROWSER_JOB_DEFAULT_RETRY_MS, 1_000),
        BROWSER_JOB_MAX_RETRY_MS,
      )
      const retryableCode = [
        'provider_rate_limited',
        'provider_timeout',
        'provider_unavailable',
      ].includes(input.code)
      const resumablePoll = job.providerJobId !== null
      const safeSubmissionRetry
        = input.code === 'provider_rate_limited'
          && input.safeToResubmit === true
          && job.providerJobId === null
      if (
        job.browserAttemptCount < BROWSER_JOB_MAX_ATTEMPTS
        && retryableCode
        && (resumablePoll || safeSubmissionRetry)
      ) {
        const retry = await trx
          .updateTable('generationJobs')
          .set({
            browserNextEligibleAt: sql<Date>`now() + (${retryDelayMs} * interval '1 millisecond')`,
            errorCode: null,
            errorMessage: null,
            ...(safeSubmissionRetry
              ? {
                  browserSubmissionState: 'not_started' as const,
                  providerSettlementResolvedAt: null,
                  providerSettlementStatus: 'not_required' as const,
                  providerSubmittedAt: null,
                }
              : {}),
            status: 'pending',
          })
          .where('organizationId', '=', input.organizationId)
          .where('id', '=', job.id)
          .where('status', '=', 'running')
          .returning('browserNextEligibleAt')
          .executeTakeFirst()
        if (retry?.browserNextEligibleAt) {
          return {
            nextEligibleAt: retry.browserNextEligibleAt.toISOString(),
            state: 'retrying' as const,
          }
        }
      }
      const failed = await markJobFailed(
        {
          failure: toSafeRunFailure(new Error(input.code), input.code),
          jobId: job.id,
          organizationId: input.organizationId,
        },
        trx,
      )
      if (!failed) {
        // Another path settled this job first; the reported failure is stale and
        // must not overwrite settlement or skip descendants of a valid branch.
        return { state: 'superseded' as const }
      }
      await trx
        .updateTable('generationJobs')
        .set({
          providerSettlementResolvedAt:
            job.providerSubmittedAt === null ? null : new Date(),
          providerSettlementStatus:
            job.providerSubmittedAt === null ? 'not_required' : 'unknown',
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', job.id)
        .execute()
      await skipDescendants(
        {
          failedNodeIds: [job.nodeId],
          flowRunId: input.runId,
          graphSnapshot: artifact.snapshot,
          organizationId: input.organizationId,
        },
        trx,
      )
      await aggregateFlowRunState(input.organizationId, input.runId, trx)
      return { failed: true as const }
    },
  )
  await retireBrowserRunLeaseIfTerminal(input)
  return result
}
