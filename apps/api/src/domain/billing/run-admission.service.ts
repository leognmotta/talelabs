/** Shared run-admission bridge from commercial policy to DB reservations. */

import type { Database, Transaction } from '@talelabs/db'

import { BILLING_CATALOG, getBillingPlan } from '@talelabs/billing'
import {
  ensureOrganizationBillingState,
  reconcileDueSubscriptionGrants,
  reconcileExpiredPaidEntitlement,
  reserveRunCredits,
  reserveRunOutputStorage,
} from '@talelabs/db'

/** One persisted job's immutable billing and storage admission facts. */
export interface PersistedRunBillingJob {
  /** Durable job receiving the quote and storage hold. */
  generationJobId: string
  /** Whole credits required when the run is billable. */
  quotedCredits: number | null
  /** Conservative generated-output byte hold. */
  storageReservedBytes: number
}

/** Funds a managed Credits run or reserves storage for BYOK execution. */
export async function admitRunBilling(input: {
  /** Debug swaps only provider execution and retains the funding contract. */
  executionMode: 'debug' | 'live'
  /** Browser BYOK and managed Credits remain separate funding contracts. */
  fundingSource: 'byok' | 'credits'
  /** Persisted jobs in stable planner order. */
  jobs: readonly PersistedRunBillingJob[]
  /** Tenant owning the admitted run. */
  organizationId: string
  /** Durable run whose dispatch waits for this transaction. */
  runId: string
  /** Caller-owned run-admission transaction. */
  trx: Transaction<Database>
}) {
  await ensureOrganizationBillingState({
    catalogRevision: BILLING_CATALOG.revision,
    organizationId: input.organizationId,
  }, input.trx)
  await reconcileExpiredPaidEntitlement(
    input.organizationId,
    input.trx,
  )
  await reconcileDueSubscriptionGrants(
    input.organizationId,
    input.trx,
  )
  const account = await input.trx.selectFrom('organizationBillingAccounts')
    .select('currentPlanCode')
    .where('organizationId', '=', input.organizationId)
    .executeTakeFirstOrThrow()
  const storageLimitBytes = getBillingPlan(account.currentPlanCode).storageBytes
  const billable = input.fundingSource === 'credits'
  if (billable) {
    const jobs = input.jobs.map((job) => {
      if (job.quotedCredits === null)
        throw new Error('billable_job_quote_missing')
      return {
        generationJobId: job.generationJobId,
        quotedCredits: job.quotedCredits,
        storageReservedBytes: job.storageReservedBytes,
      }
    })
    return reserveRunCredits({
      catalogRevision: BILLING_CATALOG.revision,
      jobs,
      organizationId: input.organizationId,
      pricingPolicyVersion: BILLING_CATALOG.revision,
      runId: input.runId,
      storageLimitBytes,
    }, input.trx)
  }
  await input.trx.updateTable('flowRuns')
    .set({ fundingSource: input.fundingSource })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.runId)
    .execute()
  return reserveRunOutputStorage({
    catalogRevision: BILLING_CATALOG.revision,
    jobs: input.jobs,
    organizationId: input.organizationId,
    runId: input.runId,
    storageLimitBytes,
  }, input.trx)
}
