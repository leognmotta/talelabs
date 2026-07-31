/** Durable retry selection and quarantine for terminal credit settlements. */

import type { DatabaseExecutor } from './index.js'

import { db, withDatabaseTransaction } from './index.js'

const MAX_RECONCILIATION_ATTEMPTS = 5
const RETRY_DELAYS_MS = [
  5 * 60 * 1_000,
  15 * 60 * 1_000,
  60 * 60 * 1_000,
  6 * 60 * 60 * 1_000,
] as const

function assertPageLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000)
    throw new RangeError('A settlement reconciliation page must be bounded.')
}

function retryAt(attempts: number, now: Date) {
  const delay = RETRY_DELAYS_MS[
    Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)
  ]!
  return new Date(now.getTime() + delay)
}

/** Lists one bounded page of terminal jobs currently eligible for settlement. */
export async function listPendingGenerationJobSettlements(input: {
  /** Maximum jobs returned by this sweep. */
  limit: number
  /** Stable task instant used for retry eligibility. */
  now: Date
}, database: DatabaseExecutor = db) {
  assertPageLimit(input.limit)
  return database.selectFrom('generationJobs')
    .select(['id', 'organizationId', 'status'])
    .where('creditSettlement', '=', 'reserved')
    .where('status', 'in', ['canceled', 'failed', 'succeeded'])
    .where('creditSettlementReconciliationQuarantinedAt', 'is', null)
    .where(eb => eb.or([
      eb('creditSettlementReconciliationNextAt', 'is', null),
      eb('creditSettlementReconciliationNextAt', '<=', input.now),
    ]))
    .orderBy('completedAt')
    .orderBy('id')
    .limit(input.limit)
    .execute()
}

/** Records backoff or terminal quarantine after one isolated job failure. */
export async function recordGenerationJobSettlementFailure(input: {
  /** Stable non-secret failure classification. */
  errorCode: string
  /** Terminal generation job that could not settle. */
  generationJobId: string
  /** Stable task instant used for retry and quarantine timestamps. */
  now: Date
  /** Tenant owning the job and its credit reservation. */
  organizationId: string
}, database: DatabaseExecutor = db) {
  if (!/^[a-z][a-z0-9_]{0,127}$/.test(input.errorCode))
    throw new RangeError('A settlement reconciliation error code is invalid.')
  return withDatabaseTransaction(database, async (trx) => {
    const job = await trx.selectFrom('generationJobs')
      .select([
        'creditSettlement',
        'creditSettlementReconciliationAttempts',
        'status',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (
      job.creditSettlement !== 'reserved'
      || !['canceled', 'failed', 'succeeded'].includes(job.status)
    ) {
      return { state: 'not_pending' as const }
    }
    const attempts = job.creditSettlementReconciliationAttempts + 1
    const quarantined = attempts >= MAX_RECONCILIATION_ATTEMPTS
    await trx.updateTable('generationJobs')
      .set({
        creditSettlementReconciliationAttemptedAt: input.now,
        creditSettlementReconciliationAttempts: attempts,
        creditSettlementReconciliationErrorCode: input.errorCode,
        creditSettlementReconciliationNextAt:
          quarantined ? null : retryAt(attempts, input.now),
        creditSettlementReconciliationQuarantinedAt:
          quarantined ? input.now : null,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .where('creditSettlement', '=', 'reserved')
      .executeTakeFirstOrThrow()
    return {
      attempts,
      quarantined,
      state: 'recorded' as const,
    }
  })
}
