/** Durable monthly subscription credit ceilings and schedule transitions. */

import type { DatabaseExecutor } from './index.js'

import { createId } from '@paralleldrive/cuid2'

/** Creates or validates one monthly credit ceiling in the current schedule. */
export async function ensureSubscriptionCreditPeriod(input: {
  /** Local subscription owning the schedule. */
  billingSubscriptionId: string
  /** Tenant owning the subscription. */
  organizationId: string
  /** Zero-based month in the schedule. */
  ordinal: number
  /** Exclusive monthly boundary. */
  periodEnd: Date
  /** Inclusive monthly boundary. */
  periodStart: Date
  /** Current schedule generation. */
  scheduleRevision: bigint | number | string
  /** Maximum credits countable in the period. */
  targetCredits: number
}, database: DatabaseExecutor) {
  await database.insertInto('subscriptionCreditPeriods')
    .values({
      billingSubscriptionId: input.billingSubscriptionId,
      id: createId(),
      ordinal: input.ordinal,
      organizationId: input.organizationId,
      periodEnd: input.periodEnd,
      periodStart: input.periodStart,
      scheduleRevision: input.scheduleRevision,
      targetCredits: input.targetCredits,
    })
    .onConflict(conflict => conflict
      .columns([
        'organizationId',
        'billingSubscriptionId',
        'scheduleRevision',
        'ordinal',
      ])
      .doNothing())
    .execute()
  const period = await database.selectFrom('subscriptionCreditPeriods')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('billingSubscriptionId', '=', input.billingSubscriptionId)
    .where('scheduleRevision', '=', String(input.scheduleRevision))
    .where('ordinal', '=', input.ordinal)
    .executeTakeFirstOrThrow()
  if (
    period.periodStart.getTime() !== input.periodStart.getTime()
    || period.periodEnd.getTime() !== input.periodEnd.getTime()
    || period.targetCredits < input.targetCredits
  ) {
    throw new Error('subscription_credit_period_facts_mismatch')
  }
  return period
}
