/** Shared lock ordering for Stripe subscription and Invoice projections. */

import type { DatabaseExecutor } from '@talelabs/db'

/**
 * Locks one billing account before all of its subscriptions in stable ID order.
 *
 * Lifecycle and Invoice handlers share this boundary so concurrent webhook
 * delivery cannot acquire the same financial rows in opposite orders.
 */
export async function lockOrganizationSubscriptionState(
  organizationId: string,
  database: DatabaseExecutor,
) {
  const account = await database
    .selectFrom('organizationBillingAccounts')
    .select([
      'managedExecutionReason',
      'managedExecutionStatus',
      'paidThrough',
      'stripeCustomerId',
    ])
    .where('organizationId', '=', organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  const subscriptions = await database
    .selectFrom('billingSubscriptions')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .orderBy('id')
    .forUpdate()
    .execute()
  return { account, subscriptions }
}
