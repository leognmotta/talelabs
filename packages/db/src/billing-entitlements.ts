/** Transactional expiration of paid plan entitlements outside read paths. */

import type { DatabaseExecutor } from './index.js'

import { withDatabaseTransaction } from './index.js'

/** Falls an expired paid projection back to Free without clearing review blocks. */
export async function reconcileExpiredPaidEntitlement(
  organizationId: string,
  database: DatabaseExecutor,
  now = new Date(),
) {
  return withDatabaseTransaction(database, async (trx) => {
    const account = await trx.selectFrom('organizationBillingAccounts')
      .select([
        'currentPlanCode',
        'managedExecutionStatus',
        'paidThrough',
      ])
      .where('organizationId', '=', organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (
      account.currentPlanCode === 'free'
      || !account.paidThrough
      || account.paidThrough > now
    ) {
      return false
    }
    await trx.updateTable('organizationBillingAccounts')
      .set(eb => ({
        currentOfferCode: null,
        currentPlanCode: 'free',
        currentRecurringOptionCode: null,
        managedExecutionReason:
          account.managedExecutionStatus === 'blocked_review'
            ? eb.ref('managedExecutionReason')
            : null,
        managedExecutionStatus:
          account.managedExecutionStatus === 'blocked_review'
            ? eb.ref('managedExecutionStatus')
            : 'active',
        paidThrough: null,
        revision: eb('revision', '+', '1'),
        updatedAt: now,
      }))
      .where('organizationId', '=', organizationId)
      .execute()
    return true
  })
}
