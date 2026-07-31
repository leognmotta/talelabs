/** Transactional Asset storage quota enforcement and projection reconciliation. */

import type { DatabaseExecutor } from './index.js'

import {
  BillingAccountingError,
  ensureOrganizationBillingState,
} from './billing-state.js'
import { db, withDatabaseTransaction } from './index.js'

/** One per-job generated-output byte hold. */
export interface ReservableStorageJob {
  /** Durable generation job receiving the hold. */
  generationJobId: string
  /** Conservative bytes held for every planned output. */
  storageReservedBytes: number
}

/** Reserves generated-output bytes for a non-billable BYOK or debug run. */
export async function reserveRunOutputStorage(
  input: {
    /** Current catalog revision used for lazy projection initialization. */
    catalogRevision: string
    /** Jobs in stable execution-plan order. */
    jobs: readonly ReservableStorageJob[]
    /** Tenant owning the run. */
    organizationId: string
    /** Durable run receiving the aggregate hold. */
    runId: string
    /** Current plan storage entitlement in bytes. */
    storageLimitBytes: number
  },
  database: DatabaseExecutor,
) {
  const bytes = input.jobs.reduce(
    (total, job) => total + job.storageReservedBytes,
    0,
  )
  if (!Number.isSafeInteger(bytes) || bytes < 0)
    throw new RangeError('A storage hold must contain safe whole bytes.')
  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(input, trx)
    const run = await trx.selectFrom('flowRuns')
      .select('storageReservedBytes')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (BigInt(run.storageReservedBytes) > 0n)
      return { replayed: true as const, reservedBytes: run.storageReservedBytes }
    const usage = await trx.selectFrom('organizationStorageUsage')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (
      BigInt(usage.usedBytes) + BigInt(usage.reservedBytes) + BigInt(bytes)
      > BigInt(input.storageLimitBytes)
    ) {
      throw new BillingAccountingError(
        'storage_limit_exceeded',
        'The organization storage limit would be exceeded.',
      )
    }
    for (const job of input.jobs) {
      await trx.updateTable('generationJobs')
        .set({ storageReservedBytes: job.storageReservedBytes })
        .where('organizationId', '=', input.organizationId)
        .where('flowRunId', '=', input.runId)
        .where('id', '=', job.generationJobId)
        .executeTakeFirstOrThrow()
    }
    await trx.updateTable('organizationStorageUsage')
      .set(eb => ({
        reservedBytes: eb('reservedBytes', '+', bytes.toString()),
        updatedAt: new Date(),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    await trx.updateTable('flowRuns')
      .set({ storageReservedBytes: bytes })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .execute()
    return { replayed: false as const, reservedBytes: bytes.toString() }
  })
}

/** Claims canonical bytes for one uploaded Asset before registration commits. */
export async function claimUploadedAssetStorage(
  input: {
    /** Current catalog revision used when lazy initialization is required. */
    catalogRevision: string
    /** Tenant owning the new Asset. */
    organizationId: string
    /** Current plan storage entitlement in bytes. */
    storageLimitBytes: number
    /** Verified uploaded object size. */
    sizeBytes: number
  },
  database: DatabaseExecutor,
) {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1)
    throw new RangeError('Uploaded Asset size must be positive whole bytes.')
  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(input, trx)
    const usage = await trx.selectFrom('organizationStorageUsage')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const next = BigInt(usage.usedBytes)
      + BigInt(usage.reservedBytes)
      + BigInt(input.sizeBytes)
    if (next > BigInt(input.storageLimitBytes)) {
      throw new BillingAccountingError(
        'storage_limit_exceeded',
        'The organization storage limit would be exceeded.',
      )
    }
    await trx.updateTable('organizationStorageUsage')
      .set(eb => ({
        updatedAt: new Date(),
        usedBytes: eb('usedBytes', '+', input.sizeBytes.toString()),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
  })
}

/** Converts a generated job's conservative byte hold into actual Asset bytes. */
export async function commitGeneratedAssetStorage(
  input: {
    /** Canonical generated Asset being ingested. */
    assetId: string
    /** Current plan storage entitlement in bytes. */
    storageLimitBytes: number
    /** Tenant owning the Asset and job. */
    organizationId: string
    /** Immutable number of outputs planned for the generation job. */
    outputCount: number
    /** Actual object size recorded by ingestion. */
    sizeBytes: number
  },
  database: DatabaseExecutor = db,
) {
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1)
    throw new RangeError('Generated Asset size must be positive whole bytes.')
  if (!Number.isSafeInteger(input.outputCount) || input.outputCount < 1)
    throw new RangeError('Generated output count must be a positive integer.')
  return withDatabaseTransaction(database, async (trx) => {
    const asset = await trx.selectFrom('assets')
      .select([
        'generationJobId',
        'purgedAt',
        'purgeRequestedAt',
        'sizeBytes',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.assetId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (asset.purgeRequestedAt || asset.purgedAt) {
      return {
        replayed: false as const,
        state: 'purge_won' as const,
      }
    }
    if (asset.sizeBytes !== null)
      return { replayed: true as const, state: 'committed' as const }
    if (!asset.generationJobId)
      throw new Error('generated_asset_job_missing')
    const job = await trx.selectFrom('generationJobs')
      .select(['flowRunId', 'storageReservedBytes'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', asset.generationJobId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const committedOutputs = await trx.selectFrom('assets')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('generationJobId', '=', asset.generationJobId)
      .where('sizeBytes', 'is not', null)
      .executeTakeFirstOrThrow()
    const remainingOutputs = input.outputCount - Number(committedOutputs.count)
    if (remainingOutputs < 1)
      throw new Error('generated_output_storage_count_mismatch')
    const usage = await trx.selectFrom('organizationStorageUsage')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const reserved = BigInt(job.storageReservedBytes)
    const releasedReservation = remainingOutputs === 1
      ? reserved
      : reserved / BigInt(remainingOutputs)
    const actualBytes = BigInt(input.sizeBytes)
    const excessBytes = actualBytes > releasedReservation
      ? actualBytes - releasedReservation
      : 0n
    const currentCommittedAndReservedBytes
      = BigInt(usage.usedBytes) + BigInt(usage.reservedBytes)
    // A later downgrade cannot invalidate bytes admitted by this hold.
    if (
      excessBytes > 0n
      && currentCommittedAndReservedBytes + excessBytes
      > BigInt(input.storageLimitBytes)
    ) {
      throw new BillingAccountingError(
        'storage_limit_exceeded',
        'The generated output exceeds the organization storage limit.',
      )
    }
    await trx.updateTable('organizationStorageUsage')
      .set(eb => ({
        reservedBytes: eb(
          'reservedBytes',
          '-',
          releasedReservation.toString(),
        ),
        updatedAt: new Date(),
        usedBytes: eb('usedBytes', '+', input.sizeBytes.toString()),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    await trx.updateTable('generationJobs')
      .set(eb => ({
        storageReservedBytes: eb(
          'storageReservedBytes',
          '-',
          releasedReservation.toString(),
        ),
      }))
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', asset.generationJobId)
      .execute()
    await trx.updateTable('flowRuns')
      .set(eb => ({
        storageReservedBytes: eb(
          'storageReservedBytes',
          '-',
          releasedReservation.toString(),
        ),
      }))
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', job.flowRunId)
      .execute()
    await trx.updateTable('assets')
      .set({ sizeBytes: input.sizeBytes })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.assetId)
      .execute()
    return { replayed: false as const, state: 'committed' as const }
  })
}

/** Removes canonical bytes exactly once after permanent Asset purge wins. */
export async function releasePurgedAssetStorage(
  input: {
    /** Permanently purged Asset. */
    assetId: string
    /** Tenant owning the Asset. */
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  return withDatabaseTransaction(database, async (trx) => {
    const asset = await trx.selectFrom('assets')
      .select(['purgedAt', 'sizeBytes'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.assetId)
      .forUpdate()
      .executeTakeFirst()
    if (!asset || asset.purgedAt)
      return { releasedBytes: 0, replayed: true as const }
    const bytes = BigInt(asset.sizeBytes ?? 0)
    if (bytes > 0n) {
      await trx.selectFrom('organizationStorageUsage')
        .select('organizationId')
        .where('organizationId', '=', input.organizationId)
        .forUpdate()
        .executeTakeFirstOrThrow()
      await trx.updateTable('organizationStorageUsage')
        .set(eb => ({
          updatedAt: new Date(),
          usedBytes: eb('usedBytes', '-', bytes.toString()),
          version: eb('version', '+', '1'),
        }))
        .where('organizationId', '=', input.organizationId)
        .execute()
    }
    await trx.updateTable('assets')
      .set({ purgedAt: new Date(), updatedAt: new Date() })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.assetId)
      .where('purgedAt', 'is', null)
      .execute()
    return { releasedBytes: Number(bytes), replayed: false as const }
  })
}

/** Compares the materialized projection with canonical non-purged Asset bytes. */
export async function reconcileOrganizationStorageUsage(
  organizationId: string,
  database: DatabaseExecutor = db,
) {
  const [usage, aggregate] = await Promise.all([
    database.selectFrom('organizationStorageUsage')
      .select(['reservedBytes', 'usedBytes'])
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('assets')
      .select(eb => eb.fn.coalesce(
        eb.fn.sum<string>('sizeBytes'),
        eb.val('0'),
      ).as('usedBytes'))
      .where('organizationId', '=', organizationId)
      .where('purgedAt', 'is', null)
      .executeTakeFirstOrThrow(),
  ])
  return {
    actualUsedBytes: usage.usedBytes,
    expectedUsedBytes: String(aggregate.usedBytes),
    matches: BigInt(usage.usedBytes) === BigInt(aggregate.usedBytes),
    reservedBytes: usage.reservedBytes,
  }
}
