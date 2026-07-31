/** Certifies BYOK bypass and managed debug credit accounting semantics. */

import type { Kysely } from 'kysely'

import type { Database } from '../src/schema.js'

import {
  invariant,
  seedVerifierRun,
} from './billing-verifier-support.js'

type BillingAccounting = typeof import('../src/index.js')
type RunBilling = typeof import(
  '../../../apps/api/src/domain/billing/run-admission.service.js'
)

/** Verifies that BYOK bypasses credits while managed debug behaves like live. */
export async function verifyFundingModeAccounting(
  database: Kysely<Database>,
  accounting: BillingAccounting,
  runBilling: RunBilling,
  catalogRevision: string,
) {
  await accounting.appendCreditGrant(
    {
      catalogRevision,
      createdBy: 'billing-verifier-user',
      idempotencyKey: 'grant:debug-accounting',
      offerCode: null,
      organizationId: 'billing-org-b',
      originalCredits: 10,
      outputPolicy: {
        outputVisibility: 'private',
        showcaseEligible: false,
      },
      planCode: null,
      source: 'manual',
    },
    database,
  )
  const [byokRun, debugRun] = await Promise.all([
    seedVerifierRun(database, 'billing-org-b', 'byok-bypass', 1, 'browser'),
    seedVerifierRun(database, 'billing-org-b', 'debug-accounting', 1),
  ])
  await database.transaction().execute(trx =>
    runBilling.admitRunBilling({
      executionMode: 'live',
      fundingSource: 'byok',
      jobs: [
        {
          generationJobId: byokRun.jobIds[0]!,
          quotedCredits: null,
          storageReservedBytes: 3,
        },
      ],
      organizationId: 'billing-org-b',
      runId: byokRun.runId,
      trx,
    }),
  )
  await database.transaction().execute(trx =>
    runBilling.admitRunBilling({
      executionMode: 'debug',
      fundingSource: 'credits',
      jobs: [
        {
          generationJobId: debugRun.jobIds[0]!,
          quotedCredits: 3,
          storageReservedBytes: 3,
        },
      ],
      organizationId: 'billing-org-b',
      runId: debugRun.runId,
      trx,
    }),
  )
  const reservedDebugBalance = await database
    .selectFrom('creditBalances')
    .select(['availableCredits', 'reservedCredits'])
    .where('organizationId', '=', 'billing-org-b')
    .executeTakeFirstOrThrow()
  invariant(
    reservedDebugBalance.availableCredits === 7
    && reservedDebugBalance.reservedCredits === 3,
    'debug_credits_not_reserved',
  )
  const byokSettlement = await accounting.settleGenerationJobCredits(
    {
      generationJobId: byokRun.jobIds[0]!,
      organizationId: 'billing-org-b',
      outcome: 'release',
      reasonCode: 'run_canceled',
    },
    database,
  )
  invariant(
    byokSettlement.state === 'not_applicable'
    && byokSettlement.storageReleased,
    'byok_storage_release',
  )
  const debugSettlement = await accounting.settleGenerationJobCredits(
    {
      generationJobId: debugRun.jobIds[0]!,
      organizationId: 'billing-org-b',
      outcome: 'capture',
      reasonCode: 'usable_output',
    },
    database,
  )
  invariant(
    debugSettlement.state === 'captured'
    && debugSettlement.credits === 3,
    'debug_credits_not_captured',
  )
  const capturedDebugState = await database
    .selectFrom('generationJobs')
    .innerJoin('creditBalances', join =>
      join.onRef(
        'creditBalances.organizationId',
        '=',
        'generationJobs.organizationId',
      ))
    .select([
      'creditBalances.availableCredits',
      'creditBalances.reservedCredits',
      'generationJobs.creditCost',
      'generationJobs.creditSettlement',
    ])
    .where('generationJobs.id', '=', debugRun.jobIds[0]!)
    .executeTakeFirstOrThrow()
  invariant(
    capturedDebugState.availableCredits === 7
    && capturedDebugState.reservedCredits === 0
    && capturedDebugState.creditCost === 3
    && capturedDebugState.creditSettlement === 'captured',
    'debug_credit_projection',
  )
  const bypassStorage = await database
    .selectFrom('organizationStorageUsage')
    .select('reservedBytes')
    .where('organizationId', '=', 'billing-org-b')
    .executeTakeFirstOrThrow()
  invariant(bypassStorage.reservedBytes === '0', 'bypass_storage_leak')
}
