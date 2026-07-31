/** Atomic credit reservation, per-job settlement, and ledger reconciliation. */

import type { DatabaseExecutor } from './index.js'

import { createId } from '@paralleldrive/cuid2'

import {
  BillingAccountingError,
  ensureOrganizationBillingState,
} from './billing-state.js'
import { db, withDatabaseTransaction } from './index.js'
import { releaseNonbillableJobStorage } from './job-storage-settlement.js'

/** One immutable generation-job quote admitted into a run reservation. */
export interface ReservableCreditJob {
  /** Durable generation job receiving the quote. */
  generationJobId: string
  /** Whole credits required for a usable output. */
  quotedCredits: number
  /** Conservative bytes held until output ingestion or release. */
  storageReservedBytes: number
}

/** Reserves a complete run quote and deterministic grant allocations atomically. */
export async function reserveRunCredits(
  input: {
    /** Current code-owned catalog revision. */
    catalogRevision: string
    /** Jobs in stable execution-plan order. */
    jobs: readonly ReservableCreditJob[]
    /** Tenant owning the run and balance. */
    organizationId: string
    /** Immutable credit pricing policy revision. */
    pricingPolicyVersion: string
    /** Durable run receiving the aggregate reservation. */
    runId: string
    /** Current plan storage limit in bytes. */
    storageLimitBytes: number
  },
  database: DatabaseExecutor,
) {
  const quotedCredits = input.jobs.reduce(
    (total, job) => total + job.quotedCredits,
    0,
  )
  const storageReservedBytes = input.jobs.reduce(
    (total, job) => total + job.storageReservedBytes,
    0,
  )
  if (!Number.isSafeInteger(quotedCredits) || quotedCredits < 1)
    throw new RangeError('A billable run must quote positive whole credits.')
  if (!Number.isSafeInteger(storageReservedBytes) || storageReservedBytes < 0)
    throw new RangeError('A run storage reservation must be safe whole bytes.')
  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(input, trx)
    const existing = await trx.selectFrom('creditReservations')
      .select(['id', 'quotedCredits'])
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .executeTakeFirst()
    if (existing) {
      if (existing.quotedCredits !== quotedCredits)
        throw new Error('credit_reservation_idempotency_conflict')
      return { reservationId: existing.id, replayed: true as const }
    }

    const account = await trx.selectFrom('organizationBillingAccounts')
      .select(['managedExecutionStatus', 'organizationId'])
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (account.managedExecutionStatus === 'blocked_review') {
      throw new BillingAccountingError(
        'billing_account_blocked',
        'Managed execution is blocked pending billing review.',
      )
    }
    const balance = await trx.selectFrom('creditBalances')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (balance.availableCredits < quotedCredits) {
      throw new BillingAccountingError(
        'insufficient_credits',
        'The organization does not have enough credits for this run.',
      )
    }
    const storage = await trx.selectFrom('organizationStorageUsage')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const nextStorage = BigInt(storage.usedBytes)
      + BigInt(storage.reservedBytes)
      + BigInt(storageReservedBytes)
    if (nextStorage > BigInt(input.storageLimitBytes)) {
      throw new BillingAccountingError(
        'storage_limit_exceeded',
        'The organization storage limit would be exceeded.',
      )
    }

    const grants = await trx.selectFrom('creditGrants')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('availableCredits', '>', 0)
      .orderBy(eb => eb.case()
        .when('outputVisibility', '=', 'private')
        .then(0)
        .else(1)
        .end())
      .orderBy('createdAt')
      .orderBy('id')
      .forUpdate()
      .execute()
    if (
      grants.reduce((total, grant) => total + grant.availableCredits, 0)
      < quotedCredits
    ) {
      throw new Error('credit_balance_grant_projection_mismatch')
    }

    const reservationId = createId()
    await trx.insertInto('creditReservations').values({
      capturedCredits: 0,
      flowRunId: input.runId,
      id: reservationId,
      organizationId: input.organizationId,
      pricingPolicyVersion: input.pricingPolicyVersion,
      quotedCredits,
      releasedCredits: 0,
      reservedCredits: quotedCredits,
      status: 'reserved',
    }).execute()

    let grantIndex = 0
    let currentGrantRemaining = grants[0]?.availableCredits ?? 0
    for (const job of input.jobs) {
      if (!Number.isSafeInteger(job.quotedCredits) || job.quotedCredits < 1)
        throw new RangeError('Every billable job must quote positive credits.')
      const itemId = createId()
      let remaining = job.quotedCredits
      let allocationOrder = 0
      const allocations: {
        amount: number
        grant: (typeof grants)[number]
      }[] = []
      while (remaining > 0) {
        const grant = grants[grantIndex]
        if (!grant)
          throw new Error('credit_allocation_exhausted')
        const amount = Math.min(remaining, currentGrantRemaining)
        allocations.push({ amount, grant })
        remaining -= amount
        currentGrantRemaining -= amount
        if (currentGrantRemaining === 0) {
          grantIndex += 1
          currentGrantRemaining = grants[grantIndex]?.availableCredits ?? 0
        }
      }
      const publicOutput = allocations.every(
        allocation => allocation.grant.outputVisibility === 'public'
          && allocation.grant.showcaseEligible,
      )
      await trx.insertInto('creditReservationItems').values({
        capturedCredits: 0,
        creditReservationId: reservationId,
        generationJobId: job.generationJobId,
        id: itemId,
        organizationId: input.organizationId,
        outputVisibility: publicOutput ? 'public' : 'private',
        quotedCredits: job.quotedCredits,
        releasedCredits: 0,
        showcaseEligible: publicOutput,
        status: 'reserved',
      }).execute()
      await trx.updateTable('generationJobs')
        .set({
          outputVisibility: publicOutput ? 'public' : 'private',
          showcaseEligible: publicOutput,
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', job.generationJobId)
        .where('flowRunId', '=', input.runId)
        .executeTakeFirstOrThrow()
      for (const allocation of allocations) {
        await trx.updateTable('creditGrants')
          .set(eb => ({
            availableCredits: eb(
              'availableCredits',
              '-',
              allocation.amount,
            ),
            reservedCredits: eb('reservedCredits', '+', allocation.amount),
          }))
          .where('organizationId', '=', input.organizationId)
          .where('id', '=', allocation.grant.id)
          .execute()
        await trx.insertInto('creditReservationAllocations').values({
          capturedCredits: 0,
          creditGrantId: allocation.grant.id,
          creditReservationItemId: itemId,
          organizationId: input.organizationId,
          releasedCredits: 0,
          reservedCredits: allocation.amount,
          sortOrder: allocationOrder,
        }).execute()
        await trx.insertInto('creditLedgerEntries').values({
          availableDelta: -allocation.amount,
          creditGrantId: allocation.grant.id,
          creditReservationId: reservationId,
          creditReservationItemId: itemId,
          entryType: 'reserve',
          flowRunId: input.runId,
          generationJobId: job.generationJobId,
          id: createId(),
          idempotencyKey:
            `run:${input.runId}:job:${job.generationJobId}:reserve:${allocation.grant.id}`,
          organizationId: input.organizationId,
          reasonCode: 'run_admission',
          reservedDelta: allocation.amount,
        }).execute()
        allocationOrder += 1
      }
      await trx.updateTable('generationJobs')
        .set({
          creditPricingVersion: input.pricingPolicyVersion,
          creditQuoted: job.quotedCredits,
          creditSettlement: 'reserved',
          storageReservedBytes: job.storageReservedBytes,
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', job.generationJobId)
        .where('flowRunId', '=', input.runId)
        .executeTakeFirstOrThrow()
    }

    await trx.updateTable('creditBalances')
      .set(eb => ({
        availableCredits: eb('availableCredits', '-', quotedCredits),
        reservedCredits: eb('reservedCredits', '+', quotedCredits),
        updatedAt: new Date(),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    await trx.updateTable('organizationStorageUsage')
      .set(eb => ({
        reservedBytes: eb(
          'reservedBytes',
          '+',
          storageReservedBytes.toString(),
        ),
        updatedAt: new Date(),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    await trx.updateTable('flowRuns')
      .set({
        creditQuoted: quotedCredits,
        creditReservationId: reservationId,
        fundingSource: 'credits',
        storageReservedBytes,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .executeTakeFirstOrThrow()
    return { reservationId, replayed: false as const }
  })
}

/** Captures or releases one reserved job exactly once. */
export async function settleGenerationJobCredits(
  input: {
    /** Durable generation job settlement boundary. */
    generationJobId: string
    /** Tenant owning the job. */
    organizationId: string
    /** Usable output captures; every other terminal result releases. */
    outcome: 'capture' | 'release'
    /** Stable terminal reason used by the append-only ledger. */
    reasonCode: string
  },
  database: DatabaseExecutor = db,
) {
  return withDatabaseTransaction(database, async (trx) => {
    const identity = await trx.selectFrom('creditReservationItems')
      .select(['creditReservationId', 'id', 'quotedCredits', 'status'])
      .where('organizationId', '=', input.organizationId)
      .where('generationJobId', '=', input.generationJobId)
      .executeTakeFirst()
    if (!identity) {
      const storageReleased = await releaseNonbillableJobStorage({
        generationJobId: input.generationJobId,
        organizationId: input.organizationId,
      }, trx)
      return {
        state: 'not_applicable' as const,
        storageReleased,
      }
    }
    if (identity.status !== 'reserved')
      return { state: identity.status, replayed: true as const }

    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    await trx.selectFrom('creditBalances')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const allocationIds = await trx.selectFrom('creditReservationAllocations')
      .select('creditGrantId')
      .where('organizationId', '=', input.organizationId)
      .where('creditReservationItemId', '=', identity.id)
      .orderBy('sortOrder')
      .execute()
    const grantIds = allocationIds.map(row => row.creditGrantId).toSorted()
    if (grantIds.length) {
      await trx.selectFrom('creditGrants')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('id', 'in', grantIds)
        .orderBy('id')
        .forUpdate()
        .execute()
    }
    const item = await trx.selectFrom('creditReservationItems')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', identity.id)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (item.status !== 'reserved')
      return { state: item.status, replayed: true as const }
    const reservation = await trx.selectFrom('creditReservations')
      .select([
        'capturedCredits',
        'quotedCredits',
        'releasedCredits',
        'reservedCredits',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', item.creditReservationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const job = await trx.selectFrom('generationJobs')
      .select(['flowRunId', 'storageReservedBytes'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const allocations = await trx
      .selectFrom('creditReservationAllocations')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('creditReservationItemId', '=', item.id)
      .orderBy('sortOrder')
      .execute()

    for (const allocation of allocations) {
      const amount = allocation.reservedCredits
      await trx.updateTable('creditGrants')
        .set(eb => input.outcome === 'capture'
          ? {
              capturedCredits: eb('capturedCredits', '+', amount),
              reservedCredits: eb('reservedCredits', '-', amount),
            }
          : {
              availableCredits: eb('availableCredits', '+', amount),
              reservedCredits: eb('reservedCredits', '-', amount),
            })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', allocation.creditGrantId)
        .execute()
      await trx.updateTable('creditReservationAllocations')
        .set({
          capturedCredits: input.outcome === 'capture' ? amount : 0,
          releasedCredits: input.outcome === 'release' ? amount : 0,
          reservedCredits: 0,
        })
        .where('creditReservationItemId', '=', item.id)
        .where('creditGrantId', '=', allocation.creditGrantId)
        .execute()
      await trx.insertInto('creditLedgerEntries').values({
        availableDelta: input.outcome === 'release' ? amount : 0,
        creditGrantId: allocation.creditGrantId,
        creditReservationId: item.creditReservationId,
        creditReservationItemId: item.id,
        entryType: input.outcome,
        flowRunId: job.flowRunId,
        generationJobId: input.generationJobId,
        id: createId(),
        idempotencyKey:
          `job:${input.generationJobId}:${input.outcome}:${allocation.creditGrantId}`,
        organizationId: input.organizationId,
        reasonCode: input.reasonCode,
        reservedDelta: -amount,
      }).execute()
    }
    await trx.updateTable('creditBalances')
      .set(eb => ({
        availableCredits: input.outcome === 'release'
          ? eb('availableCredits', '+', item.quotedCredits)
          : eb.ref('availableCredits'),
        reservedCredits: eb('reservedCredits', '-', item.quotedCredits),
        updatedAt: new Date(),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    await trx.updateTable('creditReservationItems')
      .set({
        capturedCredits: input.outcome === 'capture' ? item.quotedCredits : 0,
        releasedCredits: input.outcome === 'release' ? item.quotedCredits : 0,
        status: input.outcome === 'capture' ? 'captured' : 'released',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', item.id)
      .execute()
    const capturedCredits = reservation.capturedCredits + (
      input.outcome === 'capture' ? item.quotedCredits : 0
    )
    const releasedCredits = reservation.releasedCredits + (
      input.outcome === 'release' ? item.quotedCredits : 0
    )
    const reservedCredits = reservation.reservedCredits - item.quotedCredits
    const terminal = reservedCredits === 0
    const status = !terminal
      ? 'partial' as const
      : capturedCredits === reservation.quotedCredits
        ? 'captured' as const
        : releasedCredits === reservation.quotedCredits
          ? 'released' as const
          : 'partial' as const
    await trx.updateTable('creditReservations')
      .set({
        capturedCredits,
        closedAt: terminal ? new Date() : null,
        releasedCredits,
        reservedCredits,
        status,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', item.creditReservationId)
      .execute()
    if (BigInt(job.storageReservedBytes) > 0n) {
      await trx.updateTable('organizationStorageUsage')
        .set(eb => ({
          reservedBytes: eb(
            'reservedBytes',
            '-',
            job.storageReservedBytes,
          ),
          updatedAt: new Date(),
          version: eb('version', '+', '1'),
        }))
        .where('organizationId', '=', input.organizationId)
        .execute()
      await trx.updateTable('flowRuns')
        .set(eb => ({
          storageReservedBytes: eb(
            'storageReservedBytes',
            '-',
            job.storageReservedBytes,
          ),
        }))
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', job.flowRunId)
        .execute()
    }
    await trx.updateTable('generationJobs')
      .set({
        creditCost: input.outcome === 'capture' ? item.quotedCredits : 0,
        creditSettlement: input.outcome === 'capture' ? 'captured' : 'released',
        creditSettlementReconciliationAttemptedAt: null,
        creditSettlementReconciliationAttempts: 0,
        creditSettlementReconciliationErrorCode: null,
        creditSettlementReconciliationNextAt: null,
        creditSettlementReconciliationQuarantinedAt: null,
        storageReservedBytes: 0,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .execute()
    if (terminal) {
      await trx.updateTable('flowRuns')
        .set({ creditCost: capturedCredits })
        .where('organizationId', '=', input.organizationId)
        .where('creditReservationId', '=', item.creditReservationId)
        .execute()
    }
    return {
      credits: item.quotedCredits,
      replayed: false as const,
      state: input.outcome === 'capture'
        ? 'captured' as const
        : 'released' as const,
    }
  })
}

/** Releases every still-reserved job in a terminal run idempotently. */
export async function releaseRunCredits(input: {
  /** Terminal Flow or Create run. */
  flowRunId: string
  /** Tenant owning the run. */
  organizationId: string
  /** Stable release reason. */
  reasonCode: string
}) {
  const jobs = await db.selectFrom('generationJobs')
    .select('id')
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where(eb => eb.or([
      eb('creditSettlement', '=', 'reserved'),
      eb('storageReservedBytes', '>', '0'),
    ]))
    .orderBy('id')
    .execute()
  for (const job of jobs) {
    await settleGenerationJobCredits({
      generationJobId: job.id,
      organizationId: input.organizationId,
      outcome: 'release',
      reasonCode: input.reasonCode,
    })
  }
  return jobs.length
}

/** Compares append-only ledger totals with the materialized balance. */
export async function reconcileCreditBalance(
  organizationId: string,
  database: DatabaseExecutor = db,
) {
  const [balance, ledger] = await Promise.all([
    database.selectFrom('creditBalances')
      .select(['availableCredits', 'reservedCredits'])
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('creditLedgerEntries')
      .select(eb => [
        eb.fn.coalesce(eb.fn.sum<number>('availableDelta'), eb.val(0))
          .as('availableCredits'),
        eb.fn.coalesce(eb.fn.sum<number>('reservedDelta'), eb.val(0))
          .as('reservedCredits'),
      ])
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
  ])
  return {
    actual: balance,
    expected: {
      availableCredits: Number(ledger.availableCredits),
      reservedCredits: Number(ledger.reservedCredits),
    },
    matches:
      balance.availableCredits === Number(ledger.availableCredits)
      && balance.reservedCredits === Number(ledger.reservedCredits),
  }
}
