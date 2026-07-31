/** Focused disposable-database checks for billing reconciliation recovery. */

import type { Kysely } from 'kysely'
import type { Database } from '../src/schema.js'

import {
  invariant,
  seedVerifierRun,
} from './billing-verifier-support.js'

/** Verifies cursors plus organization and settlement failure quarantine. */
export async function verifyBillingReconciliationRecovery(
  database: Kysely<Database>,
  accounting: typeof import('../src/index.js'),
  catalogRevision: string,
) {
  const taskId = 'billing-verifier-cursor'
  const firstPage = await accounting.readBillingInvariantReconciliationPage({
    limit: 1,
    taskId,
  }, database)
  const replayedPage = await accounting.readBillingInvariantReconciliationPage({
    limit: 1,
    taskId,
  }, database)
  invariant(
    firstPage.organizationIds[0] === 'billing-org-a'
    && replayedPage.organizationIds[0] === 'billing-org-a'
    && firstPage.expectedCursorOrganizationId === null,
    'billing_cursor_advanced_before_completion',
  )
  await accounting.completeBillingReconciliationPage({
    expectedCursorOrganizationId: firstPage.expectedCursorOrganizationId,
    nextCursorOrganizationId: firstPage.nextCursorOrganizationId,
    taskId,
  }, database)
  const secondPage = await accounting.readBillingInvariantReconciliationPage({
    limit: 1,
    taskId,
  }, database)
  invariant(
    secondPage.organizationIds[0] === 'billing-org-b',
    'billing_cursor_did_not_advance_after_completion',
  )

  const failureTaskId = 'billing-verifier-organization-failures'
  const failureNow = new Date()
  await accounting.recordBillingReconciliationFailure({
    errorCode: 'billing_verifier_failure',
    now: failureNow,
    organizationId: 'billing-org-a',
    taskId: failureTaskId,
  }, database)
  const failurePage = await accounting
    .selectBillingReconciliationOrganizations({
      now: failureNow,
      pageOrganizationIds: ['billing-org-a', 'billing-org-b'],
      recoveryLimit: 1,
      taskId: failureTaskId,
    }, database)
  invariant(
    failurePage.organizationIds.length === 1
    && failurePage.organizationIds[0] === 'billing-org-b'
    && failurePage.deferredOrganizationCount === 1,
    'billing_failure_did_not_isolate_organization',
  )
  await accounting.completeBillingReconciliationPage({
    expectedCursorOrganizationId: null,
    nextCursorOrganizationId: 'billing-org-b',
    taskId: failureTaskId,
  }, database)
  const pageAfterFailure = await accounting
    .readBillingInvariantReconciliationPage({
      limit: 1,
      taskId: failureTaskId,
    }, database)
  invariant(
    pageAfterFailure.organizationIds[0] === 'billing-org-z-reconciliation',
    'billing_failure_starved_later_organization',
  )
  for (let attempt = 1; attempt < 5; attempt += 1) {
    await accounting.recordBillingReconciliationFailure({
      errorCode: 'billing_verifier_failure',
      now: new Date(failureNow.getTime() + attempt),
      organizationId: 'billing-org-a',
      taskId: failureTaskId,
    }, database)
  }
  const quarantinedFailure = await database
    .selectFrom('billingReconciliationFailures')
    .select(['attempts', 'quarantinedAt'])
    .where('taskId', '=', failureTaskId)
    .where('organizationId', '=', 'billing-org-a')
    .executeTakeFirstOrThrow()
  invariant(
    quarantinedFailure.attempts === 5
    && quarantinedFailure.quarantinedAt !== null,
    'billing_organization_failure_not_quarantined',
  )

  await accounting.appendCreditGrant({
    catalogRevision,
    createdBy: 'billing-verifier-user',
    idempotencyKey: 'grant:settlement-quarantine',
    offerCode: null,
    organizationId: 'billing-org-z-reconciliation',
    originalCredits: 10,
    outputPolicy: {
      outputVisibility: 'private',
      showcaseEligible: false,
    },
    planCode: null,
    source: 'manual',
  }, database)
  const run = await seedVerifierRun(
    database,
    'billing-org-z-reconciliation',
    'settlement-quarantine',
    1,
  )
  const generationJobId = run.jobIds[0]!
  await accounting.reserveRunCredits({
    catalogRevision,
    jobs: [{
      generationJobId,
      quotedCredits: 5,
      storageReservedBytes: 1,
    }],
    organizationId: 'billing-org-z-reconciliation',
    pricingPolicyVersion: catalogRevision,
    runId: run.runId,
    storageLimitBytes: 100,
  }, database)
  await database.updateTable('generationJobs')
    .set({ completedAt: new Date(), status: 'failed' })
    .where('organizationId', '=', 'billing-org-z-reconciliation')
    .where('id', '=', generationJobId)
    .execute()
  const now = new Date()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await accounting.recordGenerationJobSettlementFailure({
      errorCode: 'credit_reservation_item_inconsistent',
      generationJobId,
      now: new Date(now.getTime() + attempt),
      organizationId: 'billing-org-z-reconciliation',
    }, database)
  }
  const quarantined = await database.selectFrom('generationJobs')
    .select([
      'creditSettlementReconciliationAttempts',
      'creditSettlementReconciliationQuarantinedAt',
    ])
    .where('id', '=', generationJobId)
    .executeTakeFirstOrThrow()
  invariant(
    quarantined.creditSettlementReconciliationAttempts === 5
    && quarantined.creditSettlementReconciliationQuarantinedAt !== null,
    'settlement_failure_not_quarantined',
  )
  const eligible = await accounting.listPendingGenerationJobSettlements({
    limit: 200,
    now: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
  }, database)
  invariant(
    !eligible.some(job => job.id === generationJobId),
    'quarantined_settlement_remained_eligible',
  )
  await accounting.settleGenerationJobCredits({
    generationJobId,
    organizationId: 'billing-org-z-reconciliation',
    outcome: 'release',
    reasonCode: 'billing_verifier_release',
  }, database)
  const recovered = await database.selectFrom('generationJobs')
    .select([
      'creditSettlement',
      'creditSettlementReconciliationAttempts',
      'creditSettlementReconciliationQuarantinedAt',
    ])
    .where('id', '=', generationJobId)
    .executeTakeFirstOrThrow()
  invariant(
    recovered.creditSettlement === 'released'
    && recovered.creditSettlementReconciliationAttempts === 0
    && recovered.creditSettlementReconciliationQuarantinedAt === null,
    'settlement_recovery_state_not_cleared',
  )
}
