/** Hourly bounded reconciliation of paid monthly subscription grants. */

import {
  completeBillingReconciliationPage,
  db,
  readSubscriptionGrantReconciliationPage,
  reconcileDueSubscriptionGrants,
  reconcileExpiredPaidEntitlement,
  selectBillingReconciliationOrganizations,
} from '@talelabs/db'
import { schedules } from '@trigger.dev/sdk'

import { runBillingOrganizationReconciliation } from '../../billing/reconciliation-runner.js'

const TASK_ID = 'billing-grants-reconcile'

/** Accelerates grant delivery while managed run admission remains a backstop. */
export const reconcileBillingGrantsTask = schedules.task({
  cron: '7 * * * *',
  id: TASK_ID,
  queue: { concurrencyLimit: 1 },
  run: async () => {
    const now = new Date()
    const page = await readSubscriptionGrantReconciliationPage({
      limit: 100,
      taskId: TASK_ID,
    }, db)
    const selected = await selectBillingReconciliationOrganizations({
      now,
      pageOrganizationIds: page.organizationIds,
      recoveryLimit: 25,
      taskId: TASK_ID,
    }, db)
    const reconciliation = await runBillingOrganizationReconciliation({
      database: db,
      now,
      organizationIds: selected.organizationIds,
      reconcile: async (organizationId) => {
        const result = await reconcileDueSubscriptionGrants(
          organizationId,
          db,
        )
        await reconcileExpiredPaidEntitlement(organizationId, db)
        return result
      },
      taskId: TASK_ID,
    })
    await completeBillingReconciliationPage({
      expectedCursorOrganizationId: page.expectedCursorOrganizationId,
      nextCursorOrganizationId: page.nextCursorOrganizationId,
      taskId: TASK_ID,
    }, db)
    const totals = reconciliation.results.reduce(
      (current, result) => ({
        grantCount: current.grantCount + result.grantCount,
        grantedCredits: current.grantedCredits + result.grantedCredits,
      }),
      { grantCount: 0, grantedCredits: 0 },
    )
    return {
      ...totals,
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
