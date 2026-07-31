/** Periodic credit and Asset-storage projection invariant verification. */

import {
  completeBillingReconciliationPage,
  db,
  readBillingInvariantReconciliationPage,
  reconcileCreditBalance,
  reconcileOrganizationStorageUsage,
  selectBillingReconciliationOrganizations,
} from '@talelabs/db'
import { schedules } from '@trigger.dev/sdk'

import { runBillingOrganizationReconciliation } from '../../billing/reconciliation-runner.js'

const TASK_ID = 'billing-invariants-verify'

/** Detects projection drift without rewriting append-only financial history. */
export const verifyBillingInvariantsTask = schedules.task({
  cron: '23 */6 * * *',
  id: TASK_ID,
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const now = new Date()
    const page = await readBillingInvariantReconciliationPage({
      limit: 200,
      taskId: TASK_ID,
    }, db)
    const selected = await selectBillingReconciliationOrganizations({
      now,
      pageOrganizationIds: page.organizationIds,
      recoveryLimit: 50,
      taskId: TASK_ID,
    }, db)
    const reconciliation = await runBillingOrganizationReconciliation({
      database: db,
      now,
      organizationIds: selected.organizationIds,
      reconcile: async (organizationId) => {
        const [credits, storage] = await Promise.all([
          reconcileCreditBalance(organizationId, db),
          reconcileOrganizationStorageUsage(organizationId, db),
        ])
        if (!credits.matches)
          throw new Error('credit_balance_reconciliation_failed')
        if (!storage.matches)
          throw new Error('storage_projection_reconciliation_failed')
      },
      taskId: TASK_ID,
    })
    await completeBillingReconciliationPage({
      expectedCursorOrganizationId: page.expectedCursorOrganizationId,
      nextCursorOrganizationId: page.nextCursorOrganizationId,
      taskId: TASK_ID,
    }, db)
    return {
      deferredOrganizationCount: selected.deferredOrganizationCount,
      failedOrganizationCount: reconciliation.failedOrganizationCount,
      organizationsAttempted: selected.organizationIds.length,
      pageOrganizationsVisited: page.organizationIds.length,
      quarantinedOrganizationCount:
        selected.quarantinedOrganizationCount
        + reconciliation.quarantinedOrganizationCount,
      recoveryOrganizationCount: selected.recoveryOrganizationCount,
    }
  },
})
