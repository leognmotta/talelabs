/**
 * Disposable PostgreSQL certification for M8 billing persistence and accounting.
 *
 * The script provisions PostgreSQL 17 locally, creates two uniquely named
 * databases, never connects to the configured application database, and
 * removes the container after fresh and upgrade verification.
 */

import type { Kysely } from 'kysely'

import type { Database } from '../src/schema.js'

import process from 'node:process'
import { sql } from 'kysely'
import { Pool } from 'pg'

import { verifyBillingContentProjections } from './billing-content-verifier.js'
import { verifyFundingModeAccounting } from './billing-funding-mode-verifier.js'
import { verifyConcurrentCreditGrant } from './billing-grant-verifier.js'
import { verifyBillingReconciliationRecovery } from './billing-reconciliation-verifier.js'
import { verifyEarlyReversalRecovery } from './billing-reversal-ordering-verifier.js'
import { verifyRunCancellationRecovery } from './billing-run-cancellation-verifier.js'
import { verifyBillingStorageRaces } from './billing-storage-race-verifier.js'
import {
  verifySubscriptionChangeRecovery,
} from './billing-subscription-change-recovery-verifier.js'
import {
  verifyPaidSubscriptionChanges,
} from './billing-subscription-change-verifier.js'
import {
  verifySubscriptionChangeWebhookRace,
} from './billing-subscription-change-webhook-race-verifier.js'
import { verifySubscriptionPaymentGrantFacts } from './billing-subscription-payment-verifier.js'
import {
  assertSafeDatabaseName,
  connectionStringForDatabase,
  createVerifierDatabase,
  invariant,
  migrateVerifierDatabase,
  seedVerifierIdentity,
  seedVerifierRun,
} from './billing-verifier-support.js'
import { withDisposablePostgres } from './postgres-verifier-runtime.js'

const suffix = `${process.pid}_${Date.now()}`
const freshDatabaseName = `talelabs_billing_fresh_${suffix}`
const upgradeDatabaseName = `talelabs_billing_upgrade_${suffix}`

async function verifyUpgrade(database: Kysely<Database>) {
  await migrateVerifierDatabase(database, '037_clear_purged_project_covers')
  await seedVerifierIdentity(database, ['billing-upgrade-org'])
  const run = await seedVerifierRun(
    database,
    'billing-upgrade-org',
    'billing-upgrade',
    1,
    'browser',
  )
  await sql`
    insert into "assets" (
      "id",
      "organizationId",
      "name",
      "type",
      "source",
      "storageKey",
      "mimeType",
      "sizeBytes",
      "uploadId",
      "processingState"
    )
    values (
      'billing-upgrade-asset',
      'billing-upgrade-org',
      'Existing upload',
      'image',
      'upload',
      'billing-verifier/upgrade-asset',
      'image/png',
      17,
      'billing-upgrade-upload',
      'ready'
    )
  `.execute(database)
  await migrateVerifierDatabase(database)
  const projection = await sql<{
    catalogRevision: string
    fundingSource: string
    usedBytes: string
  }>`
    select
      account."catalogRevision",
      run."fundingSource",
      storage."usedBytes"::text as "usedBytes"
    from "organizationBillingAccounts" account
    join "organizationStorageUsage" storage
      on storage."organizationId" = account."organizationId"
    join "flowRuns" run
      on run."organizationId" = account."organizationId"
    where account."organizationId" = 'billing-upgrade-org'
      and run."id" = ${run.runId}
  `.execute(database)
  const row = projection.rows[0]
  invariant(
    row?.catalogRevision === '2026-07-27.5',
    'upgrade_catalog_revision',
  )
  invariant(row.fundingSource === 'byok', 'browser_run_funding_backfill')
  invariant(row.usedBytes === '17', 'storage_projection_backfill')
}

async function verifyFresh(
  database: Kysely<Database>,
  adminConnectionString: string,
) {
  await migrateVerifierDatabase(database)
  await seedVerifierIdentity(database, [
    'billing-org-a',
    'billing-org-b',
    'billing-org-z-reconciliation',
    'billing-org-zz-storage-races',
    'billing-org-zz-cancellation-recovery',
    'billing-org-zz-subscription-change',
    'billing-org-zz-subscription-annual-change',
    'billing-org-zz-subscription-facts',
    'billing-org-zz-subscription-invoice-first',
    'billing-org-zz-subscription-immediate-recovery',
    'billing-org-zz-subscription-schedule-create-recovery',
    'billing-org-zz-subscription-webhook-race',
    'billing-org-zz-subscription-facts-reordered',
    'billing-org-zz-upload-intents',
    'billing-org-zz-webhook-ordering',
  ])

  process.env.POSTGRES_URL = connectionStringForDatabase(
    adminConnectionString,
    freshDatabaseName,
  )
  const accounting = await import('../src/index.js')
  const runBilling
    = await import('../../../apps/api/src/domain/billing/run-admission.service.js')
  const { cancelRun } = await import(
    '../../../apps/api/src/domain/runs/cancellation.service.js',
  )
  const { settleCanceledRunCredits } = await import(
    '../../../packages/trigger/src/billing/run-cancellation-settlement.js',
  )
  const subscriptionChanges = {
    ...await import(
      '../../../apps/api/src/domain/billing/subscription-change-intent.service.js',
    ),
    ...await import(
      '../../../apps/api/src/domain/billing/subscription-change-cancel.service.js',
    ),
    ...await import(
      '../../../apps/api/src/domain/billing/subscription-change-replay.service.js',
    ),
    ...await import(
      '../../../apps/api/src/domain/billing/subscription-change-schedule.service.js',
    ),
    ...await import(
      '../../../packages/trigger/src/billing/stripe-subscription-changes.js',
    ),
  }
  const catalogRevision = '2026-07-27.5'
  const privatePolicy = {
    outputVisibility: 'private' as const,
    showcaseEligible: false,
  }
  for (const organizationId of [
    'billing-org-a',
    'billing-org-b',
    'billing-org-z-reconciliation',
    'billing-org-zz-storage-races',
    'billing-org-zz-cancellation-recovery',
    'billing-org-zz-subscription-change',
    'billing-org-zz-subscription-annual-change',
    'billing-org-zz-subscription-facts',
    'billing-org-zz-subscription-invoice-first',
    'billing-org-zz-subscription-immediate-recovery',
    'billing-org-zz-subscription-schedule-create-recovery',
    'billing-org-zz-subscription-webhook-race',
    'billing-org-zz-subscription-facts-reordered',
    'billing-org-zz-upload-intents',
    'billing-org-zz-webhook-ordering',
  ]) {
    await accounting.ensureOrganizationBillingState(
      {
        catalogRevision,
        organizationId,
      },
      database,
    )
  }
  await verifyBillingReconciliationRecovery(
    database,
    accounting,
    catalogRevision,
  )
  await verifyBillingStorageRaces(database, accounting, catalogRevision)
  await verifyRunCancellationRecovery(
    database,
    accounting,
    cancelRun,
    settleCanceledRunCredits,
    catalogRevision,
  )
  await verifyPaidSubscriptionChanges(
    database,
    subscriptionChanges,
    accounting,
  )
  await verifySubscriptionChangeRecovery(
    database,
    subscriptionChanges,
    accounting,
  )
  await verifySubscriptionChangeWebhookRace(
    database,
    subscriptionChanges,
    accounting,
  )
  await verifySubscriptionPaymentGrantFacts(database, accounting)
  await verifyEarlyReversalRecovery(database, accounting)

  await verifyFundingModeAccounting(
    database,
    accounting,
    runBilling,
    catalogRevision,
  )

  const multiOutputRun = await seedVerifierRun(
    database,
    'billing-org-a',
    'multi-output-storage',
    1,
    'browser',
  )
  const multiOutputJobId = multiOutputRun.jobIds[0]!
  await accounting.reserveRunOutputStorage(
    {
      catalogRevision,
      jobs: [{ generationJobId: multiOutputJobId, storageReservedBytes: 10 }],
      organizationId: 'billing-org-a',
      runId: multiOutputRun.runId,
      storageLimitBytes: 100,
    },
    database,
  )
  await sql`
    insert into "assets" (
      "id", "organizationId", "name", "type", "source", "storageKey",
      "mimeType", "generationJobId", "outputIndex", "processingState"
    )
    values
      ('multi-output-a', 'billing-org-a', 'A', 'image', 'generation',
        'billing-verifier/multi-a', 'image/png', ${multiOutputJobId}, 0, 'ready'),
      ('multi-output-b', 'billing-org-a', 'B', 'image', 'generation',
        'billing-verifier/multi-b', 'image/png', ${multiOutputJobId}, 1, 'ready')
  `.execute(database)
  for (const [assetId, sizeBytes, expectedReservation] of [
    ['multi-output-a', 2, '5'],
    ['multi-output-b', 3, '0'],
  ] as const) {
    await accounting.commitGeneratedAssetStorage(
      {
        assetId,
        organizationId: 'billing-org-a',
        outputCount: 2,
        sizeBytes,
        storageLimitBytes: 1,
      },
      database,
    )
    const job = await database
      .selectFrom('generationJobs')
      .select('storageReservedBytes')
      .where('id', '=', multiOutputJobId)
      .executeTakeFirstOrThrow()
    invariant(
      job.storageReservedBytes === expectedReservation,
      'multi_output_storage_reservation',
    )
  }

  const initialGrant = await verifyConcurrentCreditGrant(
    database,
    accounting,
    catalogRevision,
  )

  const concurrentRuns = await Promise.all([
    seedVerifierRun(database, 'billing-org-a', 'concurrent-a', 1),
    seedVerifierRun(database, 'billing-org-a', 'concurrent-b', 1),
  ])
  const admissions = await Promise.allSettled(
    concurrentRuns.map(run =>
      accounting.reserveRunCredits(
        {
          catalogRevision,
          jobs: [
            {
              generationJobId: run.jobIds[0]!,
              quotedCredits: 80,
              storageReservedBytes: 5,
            },
          ],
          organizationId: 'billing-org-a',
          pricingPolicyVersion: catalogRevision,
          runId: run.runId,
          storageLimitBytes: 100,
        },
        database,
      ),
    ),
  )
  invariant(
    admissions.filter(result => result.status === 'fulfilled').length === 1,
    'concurrent_admission_overspent',
  )
  const admittedIndex = admissions.findIndex(
    result => result.status === 'fulfilled',
  )
  const admittedRun = concurrentRuns[admittedIndex]!
  await accounting.settleGenerationJobCredits(
    {
      generationJobId: admittedRun.jobIds[0]!,
      organizationId: 'billing-org-a',
      outcome: 'capture',
      reasonCode: 'usable_output',
    },
    database,
  )
  const captureReplay = await accounting.settleGenerationJobCredits(
    {
      generationJobId: admittedRun.jobIds[0]!,
      organizationId: 'billing-org-a',
      outcome: 'capture',
      reasonCode: 'usable_output',
    },
    database,
  )
  invariant(captureReplay.replayed, 'capture_idempotency')
  const refund = await accounting.reverseUnusedCreditGrant(
    {
      creditGrantId: initialGrant.grantId,
      idempotencyKey: 'refund:event:one',
      organizationId: 'billing-org-a',
      reasonCode: 'payment_refunded',
    },
    database,
  )
  invariant(refund.reversedCredits === 20, 'refund_unused_only')
  invariant(
    (
      await accounting.reverseUnusedCreditGrant(
        {
          creditGrantId: initialGrant.grantId,
          idempotencyKey: 'refund:event:one',
          organizationId: 'billing-org-a',
          reasonCode: 'payment_refunded',
        },
        database,
      )
    ).replayed,
    'refund_idempotency',
  )

  const disputedGrant = await accounting.appendCreditGrant(
    {
      catalogRevision,
      createdBy: 'billing-verifier-user',
      idempotencyKey: 'grant:dispute',
      offerCode: null,
      organizationId: 'billing-org-a',
      originalCredits: 50,
      outputPolicy: privatePolicy,
      planCode: null,
      source: 'manual',
    },
    database,
  )
  const dispute = await accounting.reverseUnusedCreditGrant(
    {
      creditGrantId: disputedGrant.grantId,
      idempotencyKey: 'dispute:event:one',
      organizationId: 'billing-org-a',
      reasonCode: 'payment_disputed',
    },
    database,
  )
  invariant(dispute.reversedCredits === 50, 'dispute_reversal')
  invariant(
    (await accounting.reconcileCreditBalance('billing-org-a', database))
      .matches,
    'ledger_balance_reconciliation_a',
  )

  const founder = await accounting.assignFounderStatus(
    {
      assignedBy: 'billing-verifier-user',
      organizationId: 'billing-org-b',
    },
    database,
  )
  const founderReplay = await accounting.assignFounderStatus(
    {
      assignedBy: 'billing-verifier-user',
      organizationId: 'billing-org-b',
    },
    database,
  )
  invariant(!founder.replayed && founderReplay.replayed, 'founder_idempotency')
  await accounting.appendCreditGrant(
    {
      catalogRevision,
      createdBy: 'billing-verifier-user',
      idempotencyKey: 'grant:mixed-settlement',
      offerCode: null,
      organizationId: 'billing-org-b',
      originalCredits: 200,
      outputPolicy: privatePolicy,
      planCode: null,
      source: 'manual',
    },
    database,
  )
  const mixedRun = await seedVerifierRun(database, 'billing-org-b', 'mixed', 2)
  const reservation = await accounting.reserveRunCredits(
    {
      catalogRevision,
      jobs: [
        {
          generationJobId: mixedRun.jobIds[0]!,
          quotedCredits: 30,
          storageReservedBytes: 5,
        },
        {
          generationJobId: mixedRun.jobIds[1]!,
          quotedCredits: 40,
          storageReservedBytes: 5,
        },
      ],
      organizationId: 'billing-org-b',
      pricingPolicyVersion: catalogRevision,
      runId: mixedRun.runId,
      storageLimitBytes: 100,
    },
    database,
  )
  const reservationReplay = await accounting.reserveRunCredits(
    {
      catalogRevision,
      jobs: [
        {
          generationJobId: mixedRun.jobIds[0]!,
          quotedCredits: 30,
          storageReservedBytes: 5,
        },
        {
          generationJobId: mixedRun.jobIds[1]!,
          quotedCredits: 40,
          storageReservedBytes: 5,
        },
      ],
      organizationId: 'billing-org-b',
      pricingPolicyVersion: catalogRevision,
      runId: mixedRun.runId,
      storageLimitBytes: 100,
    },
    database,
  )
  invariant(
    !reservation.replayed && reservationReplay.replayed,
    'reserve_retry',
  )
  await accounting.settleGenerationJobCredits(
    {
      generationJobId: mixedRun.jobIds[0]!,
      organizationId: 'billing-org-b',
      outcome: 'capture',
      reasonCode: 'usable_output',
    },
    database,
  )
  await accounting.settleGenerationJobCredits(
    {
      generationJobId: mixedRun.jobIds[1]!,
      organizationId: 'billing-org-b',
      outcome: 'release',
      reasonCode: 'run_canceled',
    },
    database,
  )
  invariant(
    (await accounting.reconcileCreditBalance('billing-org-b', database))
      .matches,
    'ledger_balance_reconciliation_b',
  )

  await verifyBillingContentProjections({
    accounting,
    catalogRevision,
    database,
    generationJobId: mixedRun.jobIds[0]!,
  })
  await accounting.destroyDb()
}

async function main(adminConnectionString: string) {
  for (const name of [freshDatabaseName, upgradeDatabaseName])
    assertSafeDatabaseName(name)
  const admin = new Pool({ connectionString: adminConnectionString, max: 1 })
  const databases: Kysely<Database>[] = []
  try {
    await admin.query(`create database "${freshDatabaseName}"`)
    await admin.query(`create database "${upgradeDatabaseName}"`)
    const fresh = createVerifierDatabase(
      connectionStringForDatabase(adminConnectionString, freshDatabaseName),
    )
    databases.push(fresh)
    await verifyFresh(fresh, adminConnectionString)
    await fresh.destroy()
    databases.pop()

    const upgrade = createVerifierDatabase(
      connectionStringForDatabase(adminConnectionString, upgradeDatabaseName),
    )
    databases.push(upgrade)
    await verifyUpgrade(upgrade)
    await upgrade.destroy()
    databases.pop()
    console.log(
      'M8 billing verified: fresh/037 upgrade, both historical-invoice/replacement webhook orders and their concurrent lock race, Schedule-create/update and payment-action interruption recovery, webhook-first subscription-change API replay, historical Price revision drift rejection, immutable invoice grants, terminal subscription lifecycle, out-of-order reversal recovery, replay-safe asynchronous cancellation settlement, concurrent grant/admission idempotency, isolated reconciliation recovery, quota-backed upload intents, storage races, reserve/capture/release, refunds/disputes, ledger, tenant isolation, webhook inbox, and account/usage projections.',
    )
  }
  finally {
    await Promise.all(databases.map(database => database.destroy()))
    for (const name of [freshDatabaseName, upgradeDatabaseName])
      await admin.query(`drop database if exists "${name}" with (force)`)
    await admin.end()
  }
}

await withDisposablePostgres('billing', main)
