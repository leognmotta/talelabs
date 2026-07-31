/** Terminal release of non-billable generation-job storage reservations. */

import type { DatabaseExecutor } from './index.js'

/**
 * Releases one BYOK or debug job's storage hold exactly once.
 *
 * Billable jobs must settle through their reservation item so credits and
 * storage remain one atomic transition.
 */
export async function releaseNonbillableJobStorage(input: {
  /** Non-billable generation job holding conservative output bytes. */
  generationJobId: string
  /** Tenant owning the run, job, and storage projection. */
  organizationId: string
}, database: DatabaseExecutor) {
  const job = await database.selectFrom('generationJobs')
    .select(['creditSettlement', 'flowRunId', 'storageReservedBytes'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.generationJobId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  if (job.creditSettlement !== 'not_applicable')
    throw new Error('credit_reservation_item_missing')
  const bytes = BigInt(job.storageReservedBytes)
  if (bytes === 0n)
    return false
  await database.selectFrom('organizationStorageUsage')
    .select('organizationId')
    .where('organizationId', '=', input.organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  await database.updateTable('organizationStorageUsage')
    .set(eb => ({
      reservedBytes: eb('reservedBytes', '-', bytes.toString()),
      updatedAt: new Date(),
      version: eb('version', '+', '1'),
    }))
    .where('organizationId', '=', input.organizationId)
    .execute()
  await database.updateTable('flowRuns')
    .set(eb => ({
      storageReservedBytes: eb(
        'storageReservedBytes',
        '-',
        bytes.toString(),
      ),
    }))
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', job.flowRunId)
    .execute()
  await database.updateTable('generationJobs')
    .set({ storageReservedBytes: 0 })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.generationJobId)
    .execute()
  return true
}
