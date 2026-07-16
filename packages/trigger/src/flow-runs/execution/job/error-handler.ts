import type { TaskRunContext } from '@trigger.dev/sdk'
import type { GenerationJobTaskPayload } from '../../../tasks/flow-runs/contracts.js'

import { db } from '@talelabs/db'
import { cleanupUncommittedGeneratedOutputObjects } from '../../../assets/outputs/generated-storage.js'
import { GenerationProviderError } from '../../../generation/adapters/errors.js'
import { toSafeRunFailure } from '../../../shared/failures/run-failure.js'
import { GENERATION_JOB_MAX_ATTEMPTS } from '../../../tasks/flow-runs/contracts.js'
import { logRunEngine } from '../../observability/logging.js'
import { discardCanceledGenerationResult } from '../outputs/canceled-result.js'
import {
  cancelGenerationJobAfterSettlement,
  markProviderSettlementFailed,
  markProviderSettlementUnknown,
} from '../provider-results/settlement.js'
import { markJobFailed } from './state/index.js'

export async function handleGenerationJobError(input: {
  ctx: TaskRunContext
  error: unknown
  payload: GenerationJobTaskPayload
}) {
  const { ctx, error, payload } = input
  const attemptsExhausted = ctx.attempt.number
    >= (ctx.run.maxAttempts ?? GENERATION_JOB_MAX_ATTEMPTS)
  const failure = toSafeRunFailure(error, 'generation_failed')
  const retryable = !(error instanceof GenerationProviderError)
    || error.retryable
  const state = await db.selectFrom('generationJobs as job')
    .innerJoin('flowRuns as run', join => join
      .onRef('run.id', '=', 'job.flowRunId')
      .onRef('run.organizationId', '=', 'job.organizationId'))
    .select([
      'job.flowRunId',
      'job.providerSettlementStatus',
      'job.providerSubmittedAt',
      'run.status as runStatus',
    ])
    .where('job.organizationId', '=', payload.organizationId)
    .where('job.id', '=', payload.generationJobId)
    .executeTakeFirst()
  const runCanceled = state?.runStatus === 'canceled'
  const safeToResubmit = error instanceof GenerationProviderError
    && error.safeToResubmit
  if (safeToResubmit) {
    await db.updateTable('generationJobs')
      .set({
        providerSettlementResolvedAt: null,
        providerSettlementStatus: 'not_required',
        providerSubmittedAt: null,
      })
      .where('organizationId', '=', payload.organizationId)
      .where('id', '=', payload.generationJobId)
      .where('status', '=', 'running')
      .where('providerJobId', 'is', null)
      .execute()
  }
  if (runCanceled && (!state?.providerSubmittedAt || safeToResubmit)) {
    await cancelGenerationJobAfterSettlement({
      jobId: payload.generationJobId,
      organizationId: payload.organizationId,
    })
    return { skipRetrying: true }
  }
  if (attemptsExhausted || !retryable) {
    if (state?.providerSettlementStatus === 'pending') {
      if (
        error instanceof GenerationProviderError
        && error.code === 'provider_rejected'
      ) {
        await markProviderSettlementFailed({
          jobId: payload.generationJobId,
          organizationId: payload.organizationId,
        })
      }
      else {
        await markProviderSettlementUnknown({
          jobId: payload.generationJobId,
          organizationId: payload.organizationId,
        })
      }
    }
    if (runCanceled) {
      await discardCanceledGenerationResult({
        failure,
        flowRunId: state.flowRunId,
        jobId: payload.generationJobId,
        organizationId: payload.organizationId,
      })
      return { skipRetrying: true }
    }
    await markJobFailed({
      failure,
      jobId: payload.generationJobId,
      organizationId: payload.organizationId,
    })
    await cleanupUncommittedGeneratedOutputObjects({
      generationJobId: payload.generationJobId,
      organizationId: payload.organizationId,
    })
    return { skipRetrying: true }
  }
  await db.updateTable('generationJobs')
    .set({
      errorCode: null,
      errorMessage: null,
      status: 'pending',
    })
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.generationJobId)
    .where('status', '=', 'running')
    .execute()
  logRunEngine('warn', 'generation_job.retry_scheduled', {
    attempt: ctx.attempt.number,
    generationJobId: payload.generationJobId,
    internalError: failure.internal,
    maxAttempts: ctx.run.maxAttempts ?? GENERATION_JOB_MAX_ATTEMPTS,
    organizationId: payload.organizationId,
  })
  if (error instanceof GenerationProviderError && error.retryAfterMs)
    return { retryAt: new Date(Date.now() + error.retryAfterMs) }
}
