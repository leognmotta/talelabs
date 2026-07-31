/** Cancellation idempotency and asynchronous credit-settlement certification. */

import type { Kysely } from 'kysely'

import type { Database } from '../src/schema.js'

import { invariant, seedVerifierRun } from './billing-verifier-support.js'

type BillingAccounting = typeof import('../src/index.js')
type CancelRun = typeof import(
  '../../../apps/api/src/domain/runs/cancellation.service.js'
)['cancelRun']
type SettleCanceledRunCredits = typeof import(
  '../../../packages/trigger/src/billing/run-cancellation-settlement.js'
)['settleCanceledRunCredits']

/** Certifies accepted cancellation cannot become a false post-commit failure. */
export async function verifyRunCancellationRecovery(
  database: Kysely<Database>,
  accounting: BillingAccounting,
  cancelRun: CancelRun,
  settleCanceledRunCredits: SettleCanceledRunCredits,
  catalogRevision: string,
) {
  const organizationId = 'billing-org-zz-cancellation-recovery'
  await accounting.appendCreditGrant({
    catalogRevision,
    createdBy: 'billing-verifier-user',
    idempotencyKey: 'grant:cancellation-recovery',
    offerCode: null,
    organizationId,
    originalCredits: 30,
    outputPolicy: {
      outputVisibility: 'private',
      showcaseEligible: false,
    },
    planCode: null,
    source: 'manual',
  }, database)
  const run = await seedVerifierRun(
    database,
    organizationId,
    'cancellation-recovery',
    3,
  )
  await database.updateTable('flowRuns')
    .set({
      createdBy: 'billing-verifier-user',
      triggerRunId: 'trigger-cancellation-recovery',
    })
    .where('id', '=', run.runId)
    .execute()
  await accounting.reserveRunCredits({
    catalogRevision,
    jobs: run.jobIds.map(generationJobId => ({
      generationJobId,
      quotedCredits: 2,
      storageReservedBytes: 3,
    })),
    organizationId,
    pricingPolicyVersion: catalogRevision,
    runId: run.runId,
    storageLimitBytes: 100,
  }, database)

  let dispatchAttempts = 0
  let triggerCancellationAttempts = 0
  const readRunDetail = async () => database.selectFrom('flowRuns')
    .select(['id', 'status'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', run.runId)
    .executeTakeFirstOrThrow()
  const first = await cancelRun({
    organizationId,
    runId: run.runId,
    userId: 'billing-verifier-user',
  }, {
    cancelTriggerRun: async () => {
      triggerCancellationAttempts += 1
    },
    database,
    dispatchCreditSettlement: async () => {
      dispatchAttempts += 1
      throw new Error('simulated_settlement_dispatch_failure')
    },
    readRunDetail: readRunDetail as never,
  })
  const heldAfterAcceptedCancel = await database
    .selectFrom('creditBalances')
    .select(['availableCredits', 'reservedCredits'])
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    first.status === 'canceled'
    && dispatchAttempts === 1
    && triggerCancellationAttempts === 1
    && heldAfterAcceptedCancel.availableCredits === 24
    && heldAfterAcceptedCancel.reservedCredits === 6,
    'accepted_cancellation_reported_failure',
  )

  const replay = await cancelRun({
    organizationId,
    runId: run.runId,
    userId: 'billing-verifier-user',
  }, {
    cancelTriggerRun: async () => {
      triggerCancellationAttempts += 1
    },
    database,
    dispatchCreditSettlement: async () => {
      dispatchAttempts += 1
    },
    readRunDetail: readRunDetail as never,
  })
  invariant(
    replay.status === 'canceled'
    && dispatchAttempts === 2
    && triggerCancellationAttempts === 2,
    'cancellation_replay_not_idempotent',
  )

  const settled = await settleCanceledRunCredits({
    flowRunId: run.runId,
    organizationId,
  }, database)
  const [balance, storage, reconciliation] = await Promise.all([
    database.selectFrom('creditBalances')
      .select(['availableCredits', 'reservedCredits'])
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('organizationStorageUsage')
      .select('reservedBytes')
      .where('organizationId', '=', organizationId)
      .executeTakeFirstOrThrow(),
    accounting.reconcileCreditBalance(organizationId, database),
  ])
  invariant(
    settled.releasedJobs === 3
    && settled.failedJobs === 0
    && settled.balanceMatches
    && balance.availableCredits === 30
    && balance.reservedCredits === 0
    && storage.reservedBytes === '0'
    && reconciliation.matches,
    'canceled_run_credit_release_failed',
  )
}
