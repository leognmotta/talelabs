/** Bounded repair of terminal generation jobs with open credit holds. */

import {
  listPendingGenerationJobSettlements,
  reconcileCreditBalance,
  recordGenerationJobSettlementFailure,
  settleGenerationJobCredits,
} from '@talelabs/db'
import { schedules } from '@trigger.dev/sdk'

const TASK_ID = 'billing-settlements-reconcile'

function settlementFailureCode(error: unknown) {
  const candidate = error instanceof Error
    ? ('code' in error && typeof error.code === 'string'
        ? error.code
        : error.message)
    : null
  return candidate && /^[a-z][a-z0-9_]{0,127}$/.test(candidate)
    ? candidate
    : 'billing_settlement_reconciliation_failed'
}

/** Repairs missing terminal settlement transitions idempotently. */
export const reconcileBillingSettlementsTask = schedules.task({
  cron: '*/5 * * * *',
  id: TASK_ID,
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const now = new Date()
    const jobs = await listPendingGenerationJobSettlements({
      limit: 200,
      now,
    })
    const organizations = new Set<string>()
    let failedJobs = 0
    let jobsReconciled = 0
    let quarantinedJobs = 0
    for (const job of jobs) {
      try {
        await settleGenerationJobCredits({
          generationJobId: job.id,
          organizationId: job.organizationId,
          outcome: job.status === 'succeeded' ? 'capture' : 'release',
          reasonCode: job.status === 'succeeded'
            ? 'usable_output_reconciled'
            : 'terminal_job_reconciled',
        })
        organizations.add(job.organizationId)
        jobsReconciled += 1
      }
      catch (error) {
        const failure = await recordGenerationJobSettlementFailure({
          errorCode: settlementFailureCode(error),
          generationJobId: job.id,
          now,
          organizationId: job.organizationId,
        })
        failedJobs += 1
        if (failure.state === 'recorded' && failure.quarantined)
          quarantinedJobs += 1
      }
    }
    let balanceMismatches = 0
    for (const organizationId of organizations) {
      const reconciliation = await reconcileCreditBalance(organizationId)
      if (!reconciliation.matches)
        balanceMismatches += 1
    }
    return {
      balanceMismatches,
      failedJobs,
      jobsReconciled,
      organizationsChecked: organizations.size,
      quarantinedJobs,
    }
  },
})
