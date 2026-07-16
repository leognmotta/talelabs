import { db } from '@talelabs/db'
import { runs as triggerRuns } from '@trigger.dev/sdk'

import { cleanupUncommittedGeneratedOutputObjects } from '../../assets/outputs/generated-storage.js'
import { toSafeRunFailure } from '../../shared/failures/run-failure.js'
import {
  cancelGenerationJobAfterSettlement,
  markProviderSettlementUnknown,
} from '../execution/provider-results/settlement.js'
import { claimFlowRunTriggerParent } from '../persistence/claims.js'
import {
  claimDispatchedFlowRuns,
  claimStaleGenerationJobs,
} from '../persistence/reconciliation-queries.js'
import { aggregateFlowRunState } from '../persistence/state.js'
import {
  acknowledgeCanceledRun,
  failActiveFlowRunJobs,
  retireCanceledRunJobs,
} from '../persistence/terminal-transitions.js'
import {
  ACTIVE_TRIGGER_STATUSES,
  retrieveTriggerRunStatus,
  TERMINAL_TRIGGER_STATUSES,
} from './trigger-status.js'

/** Repairs divergence between Trigger terminal state and TaleLabs durable state. */
export async function reconcileFlowRunStates(input: {
  limit?: number
  organizationId?: string
}) {
  const limit = input.limit ?? 100
  const candidates = await claimDispatchedFlowRuns({
    limit,
    organizationId: input.organizationId,
  })
  let cancellationAcknowledged = 0
  let canceled = 0
  let failed = 0

  for (const run of candidates) {
    const triggerRunId = run.triggerRunId
    const triggerState = await retrieveTriggerRunStatus(triggerRunId)
    const status = triggerState?.status ?? null
    if (triggerState?.version && run.status !== 'canceled') {
      await claimFlowRunTriggerParent({
        flowRunId: run.id,
        organizationId: run.organizationId,
        triggerDeploymentVersion: triggerState.version,
        triggerRunId,
      })
    }
    if (run.status === 'canceled') {
      const activeSubmittedJob = await db.selectFrom('generationJobs')
        .select('id')
        .where('organizationId', '=', run.organizationId)
        .where('flowRunId', '=', run.id)
        .where('status', 'in', ['pending', 'running'])
        .where('providerSubmittedAt', 'is not', null)
        .executeTakeFirst()
      if (status && ACTIVE_TRIGGER_STATUSES.has(status)) {
        if (activeSubmittedJob)
          continue
        try {
          await triggerRuns.cancel(triggerRunId)
          canceled += 1
        }
        catch {
          // Durable rotation brings this run back in a later bounded pass.
        }
      }
      else if (
        status === 'MISSING'
        || (status && TERMINAL_TRIGGER_STATUSES.has(status))
      ) {
        await retireCanceledRunJobs({
          flowRunId: run.id,
          organizationId: run.organizationId,
        })
        if (await acknowledgeCanceledRun({
          flowRunId: run.id,
          organizationId: run.organizationId,
          triggerRunId,
        })) {
          cancellationAcknowledged += 1
        }
      }
      continue
    }
    if (!status || (!TERMINAL_TRIGGER_STATUSES.has(status) && status !== 'MISSING'))
      continue
    const code = status === 'MISSING'
      ? 'trigger_run_missing' as const
      : 'trigger_parent_terminal' as const
    await failActiveFlowRunJobs({
      failure: toSafeRunFailure(new Error(`Trigger parent status: ${status}`), code),
      flowRunId: run.id,
      organizationId: run.organizationId,
    })
    failed += 1
  }

  const staleJobs = await claimStaleGenerationJobs({
    limit,
    organizationId: input.organizationId,
  })
  const affectedRuns = new Set<string>()
  for (const job of staleJobs) {
    const triggerState = job.triggerRunId
      ? await retrieveTriggerRunStatus(job.triggerRunId)
      : { status: 'MISSING' as const, version: null }
    const status = triggerState?.status ?? null
    if (!status || ACTIVE_TRIGGER_STATUSES.has(status))
      continue
    const failure = toSafeRunFailure(
      new Error(`Trigger child status: ${status}`),
      'trigger_job_stale',
    )
    if (
      job.runStatus === 'canceled'
      && job.providerSettlementStatus === 'pending'
    ) {
      await markProviderSettlementUnknown({
        jobId: job.id,
        organizationId: job.organizationId,
      })
      await cancelGenerationJobAfterSettlement({
        failure,
        jobId: job.id,
        organizationId: job.organizationId,
      })
      await cleanupUncommittedGeneratedOutputObjects({
        generationJobId: job.id,
        organizationId: job.organizationId,
      })
      continue
    }
    if (job.providerSettlementStatus === 'pending') {
      await markProviderSettlementUnknown({
        jobId: job.id,
        organizationId: job.organizationId,
      })
    }
    await db.updateTable('generationJobs')
      .set({
        completedAt: new Date(),
        errorCode: failure.code,
        errorMessage: failure.message,
        status: 'failed',
      })
      .where('organizationId', '=', job.organizationId)
      .where('id', '=', job.id)
      .where('status', '=', 'running')
      .execute()
    await cleanupUncommittedGeneratedOutputObjects({
      generationJobId: job.id,
      organizationId: job.organizationId,
    })
    affectedRuns.add(`${job.organizationId}\u0000${job.flowRunId}`)
  }
  for (const key of affectedRuns) {
    const [organizationId, flowRunId] = key.split('\u0000')
    await aggregateFlowRunState(organizationId!, flowRunId!)
  }

  return {
    cancellationAcknowledged,
    canceled,
    checked: candidates.length,
    failed,
    staleJobs: staleJobs.length,
  }
}
