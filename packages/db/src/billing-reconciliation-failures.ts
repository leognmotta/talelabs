/** Durable tenant-specific recovery queue for global billing reconciliations. */

import type { DatabaseExecutor } from './index.js'

import { withDatabaseTransaction } from './index.js'

const MAX_RECONCILIATION_ATTEMPTS = 5
const RETRY_DELAYS_MS = [
  5 * 60 * 1_000,
  15 * 60 * 1_000,
  60 * 60 * 1_000,
  6 * 60 * 60 * 1_000,
] as const

function assertLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000)
    throw new RangeError('A billing recovery page must be bounded.')
}

function retryAt(attempts: number, now: Date) {
  const delay = RETRY_DELAYS_MS[
    Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)
  ]!
  return new Date(now.getTime() + delay)
}

/** Combines due recovery tenants with one page while deferring open failures. */
export async function selectBillingReconciliationOrganizations(input: {
  /** Organizations visited by the current fair keyset page. */
  pageOrganizationIds: readonly string[]
  /** Maximum additional failed organizations recovered ahead of the page. */
  recoveryLimit: number
  /** Stable scheduled-task identity owning the failure queue. */
  taskId: string
  /** Stable task instant used for retry eligibility. */
  now: Date
}, database: DatabaseExecutor) {
  assertLimit(input.recoveryLimit)
  const recoveryRows = await database
    .selectFrom('billingReconciliationFailures')
    .select('organizationId')
    .where('taskId', '=', input.taskId)
    .where('resolvedAt', 'is', null)
    .where('quarantinedAt', 'is', null)
    .where('nextAttemptAt', '<=', input.now)
    .orderBy('nextAttemptAt')
    .orderBy('organizationId')
    .limit(input.recoveryLimit)
    .execute()
  const pageFailures = input.pageOrganizationIds.length
    ? await database.selectFrom('billingReconciliationFailures')
        .select([
          'nextAttemptAt',
          'organizationId',
          'quarantinedAt',
        ])
        .where('taskId', '=', input.taskId)
        .where('organizationId', 'in', [...input.pageOrganizationIds])
        .where('resolvedAt', 'is', null)
        .execute()
    : []
  const pageFailureByOrganization = new Map(
    pageFailures.map(failure => [failure.organizationId, failure]),
  )
  const organizationIds = new Set(
    recoveryRows.map(row => row.organizationId),
  )
  let deferredOrganizationCount = 0
  let quarantinedOrganizationCount = 0
  for (const organizationId of input.pageOrganizationIds) {
    const failure = pageFailureByOrganization.get(organizationId)
    if (!failure) {
      organizationIds.add(organizationId)
      continue
    }
    if (failure.quarantinedAt) {
      quarantinedOrganizationCount += 1
      continue
    }
    if (failure.nextAttemptAt && failure.nextAttemptAt <= input.now) {
      organizationIds.add(organizationId)
      continue
    }
    deferredOrganizationCount += 1
  }
  return {
    deferredOrganizationCount,
    organizationIds: [...organizationIds],
    quarantinedOrganizationCount,
    recoveryOrganizationCount: recoveryRows.length,
  }
}

/** Records one isolated failure with bounded backoff and terminal quarantine. */
export async function recordBillingReconciliationFailure(input: {
  /** Stable non-secret failure classification. */
  errorCode: string
  /** Tenant whose reconciliation attempt failed. */
  organizationId: string
  /** Stable scheduled-task identity owning the failure queue. */
  taskId: string
  /** Stable task instant used for retry and quarantine timestamps. */
  now: Date
}, database: DatabaseExecutor) {
  if (!/^[a-z][a-z0-9_]{0,127}$/.test(input.errorCode))
    throw new RangeError('A billing reconciliation error code is invalid.')
  return withDatabaseTransaction(database, async (trx) => {
    const inserted = await trx.insertInto('billingReconciliationFailures')
      .values({
        attempts: 1,
        lastAttemptedAt: input.now,
        lastErrorCode: input.errorCode,
        nextAttemptAt: retryAt(1, input.now),
        organizationId: input.organizationId,
        taskId: input.taskId,
      })
      .onConflict(conflict => conflict
        .columns(['taskId', 'organizationId'])
        .doNothing())
      .returning('organizationId')
      .executeTakeFirst()
    if (inserted) {
      return {
        attempts: 1,
        quarantined: false,
        state: 'recorded' as const,
      }
    }
    const current = await trx.selectFrom('billingReconciliationFailures')
      .select(['attempts', 'quarantinedAt', 'resolvedAt'])
      .where('taskId', '=', input.taskId)
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (!current.resolvedAt && current.quarantinedAt) {
      return {
        attempts: current.attempts,
        quarantined: true,
        state: 'already_quarantined' as const,
      }
    }
    const attempts = current.resolvedAt ? 1 : current.attempts + 1
    const quarantined = attempts >= MAX_RECONCILIATION_ATTEMPTS
    await trx.updateTable('billingReconciliationFailures')
      .set({
        attempts,
        lastAttemptedAt: input.now,
        lastErrorCode: input.errorCode,
        nextAttemptAt: quarantined ? null : retryAt(attempts, input.now),
        quarantinedAt: quarantined ? input.now : null,
        resolvedAt: null,
        updatedAt: input.now,
      })
      .where('taskId', '=', input.taskId)
      .where('organizationId', '=', input.organizationId)
      .executeTakeFirstOrThrow()
    return {
      attempts,
      quarantined,
      state: 'recorded' as const,
    }
  })
}

/** Closes an open tenant failure after its reconciliation succeeds. */
export async function resolveBillingReconciliationFailure(input: {
  /** Tenant whose reconciliation recovered. */
  organizationId: string
  /** Stable scheduled-task identity owning the failure queue. */
  taskId: string
  /** Successful recovery instant. */
  now: Date
}, database: DatabaseExecutor) {
  await database.updateTable('billingReconciliationFailures')
    .set({
      nextAttemptAt: null,
      resolvedAt: input.now,
      updatedAt: input.now,
    })
    .where('taskId', '=', input.taskId)
    .where('organizationId', '=', input.organizationId)
    .where('resolvedAt', 'is', null)
    .execute()
}
