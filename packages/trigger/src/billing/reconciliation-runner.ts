/** Failure-isolated execution for tenant-scoped billing reconciliations. */

import type { DatabaseExecutor } from '@talelabs/db'

import {
  recordBillingReconciliationFailure,
  resolveBillingReconciliationFailure,
} from '@talelabs/db'

function reconciliationFailureCode(error: unknown) {
  const candidate = error instanceof Error
    ? ('code' in error && typeof error.code === 'string'
        ? error.code
        : error.message)
    : null
  return candidate && /^[a-z][a-z0-9_]{0,127}$/.test(candidate)
    ? candidate
    : 'billing_organization_reconciliation_failed'
}

/** Runs organizations independently and durably records every failed tenant. */
export async function runBillingOrganizationReconciliation<Result>(input: {
  /** Database or caller-owned transaction used by recovery state. */
  database: DatabaseExecutor
  /** Stable task instant used for every transition in this run. */
  now: Date
  /** Bounded, de-duplicated tenants selected for this task run. */
  organizationIds: readonly string[]
  /** Tenant-scoped idempotent reconciliation operation. */
  reconcile: (organizationId: string) => Promise<Result>
  /** Stable deployed scheduled-task identity. */
  taskId: string
}) {
  const results: Result[] = []
  let failedOrganizationCount = 0
  let quarantinedOrganizationCount = 0
  for (const organizationId of input.organizationIds) {
    try {
      const result = await input.reconcile(organizationId)
      await resolveBillingReconciliationFailure({
        now: input.now,
        organizationId,
        taskId: input.taskId,
      }, input.database)
      results.push(result)
    }
    catch (error) {
      const failure = await recordBillingReconciliationFailure({
        errorCode: reconciliationFailureCode(error),
        now: input.now,
        organizationId,
        taskId: input.taskId,
      }, input.database)
      failedOrganizationCount += 1
      if (failure.state === 'recorded' && failure.quarantined)
        quarantinedOrganizationCount += 1
    }
  }
  return {
    failedOrganizationCount,
    quarantinedOrganizationCount,
    results,
  }
}
