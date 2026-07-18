/** Transactional discard of provider results after run cancellation wins. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { SafeRunFailure } from '../../../shared/failures/run-failure.js'

import { db, withDatabaseTransaction } from '@talelabs/db'

import { cleanupUncommittedGeneratedOutputObjects } from '../../../assets/outputs/generated-storage.js'
import { cancelGenerationJobAfterSettlement } from '../provider-results/settlement.js'

/** Discards a settled provider result only after user cancellation wins the lock. */
export async function discardCanceledGenerationResult(
  input: {
    failure?: SafeRunFailure
    flowRunId: string
    jobId: string
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  const canceled = await withDatabaseTransaction(database, async (trx) => {
    const run = await trx.selectFrom('flowRuns')
      .select('status')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.flowRunId)
      .forUpdate()
      .executeTakeFirst()
    if (run?.status !== 'canceled')
      return false
    await trx.updateTable('generationProviderOutputs')
      .set({ status: 'discarded', updatedAt: new Date() })
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .where('status', 'in', ['ready', 'staging'])
      .execute()
    return true
  })
  if (!canceled)
    return false
  await cancelGenerationJobAfterSettlement({
    failure: input.failure,
    jobId: input.jobId,
    organizationId: input.organizationId,
  }, database)
  await cleanupUncommittedGeneratedOutputObjects({
    generationJobId: input.jobId,
    organizationId: input.organizationId,
  }, database)
  return true
}
