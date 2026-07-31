/** Isolated asynchronous credit release for user-canceled generation runs. */

import type { DatabaseExecutor } from '@talelabs/db'

import {
  db,
  reconcileCreditBalance,
  recordGenerationJobSettlementFailure,
  settleGenerationJobCredits,
} from '@talelabs/db'

function settlementFailureCode(error: unknown) {
  const candidate = error instanceof Error
    ? ('code' in error && typeof error.code === 'string'
        ? error.code
        : error.message)
    : null
  return candidate && /^[a-z][a-z0-9_]{0,127}$/.test(candidate)
    ? candidate
    : 'run_cancellation_settlement_failed'
}

/**
 * Releases each still-reserved job independently so one corrupt settlement
 * cannot block the rest of the canceled run.
 */
export async function settleCanceledRunCredits(
  input: {
    /** Canceled Flow or Create run. */
    flowRunId: string
    /** Tenant owning the run and credit reservation. */
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  const run = await database.selectFrom('flowRuns')
    .select('status')
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.flowRunId)
    .executeTakeFirstOrThrow()
  if (run.status !== 'canceled')
    throw new Error('run_cancellation_settlement_not_terminal')
  const jobs = await database.selectFrom('generationJobs')
    .select('id')
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where(eb => eb.or([
      eb('creditSettlement', '=', 'reserved'),
      eb('storageReservedBytes', '>', '0'),
    ]))
    .orderBy('id')
    .execute()
  const now = new Date()
  let failedJobs = 0
  let releasedJobs = 0
  let quarantinedJobs = 0
  for (const job of jobs) {
    try {
      await settleGenerationJobCredits({
        generationJobId: job.id,
        organizationId: input.organizationId,
        outcome: 'release',
        reasonCode: 'run_canceled',
      }, database)
      releasedJobs += 1
    }
    catch (error) {
      const failure = await recordGenerationJobSettlementFailure({
        errorCode: settlementFailureCode(error),
        generationJobId: job.id,
        now,
        organizationId: input.organizationId,
      }, database)
      failedJobs += 1
      if (failure.state === 'recorded' && failure.quarantined)
        quarantinedJobs += 1
    }
  }
  const reconciliation = await reconcileCreditBalance(
    input.organizationId,
    database,
  )
  return {
    balanceMatches: reconciliation.matches,
    failedJobs,
    quarantinedJobs,
    releasedJobs,
  }
}
