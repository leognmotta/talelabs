/** Durable keyset page claims for bounded global billing reconciliation. */

import type { Transaction } from 'kysely'
import type { Database, DatabaseExecutor } from './index.js'

import { withDatabaseTransaction } from './index.js'

interface ReconciliationPageInput {
  /** Maximum organizations claimed by this scheduled run. */
  limit: number
  /** Stable deployed task identity owning the cursor. */
  taskId: string
}

function assertPageLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000)
    throw new RangeError('A billing reconciliation page must be bounded.')
}

async function lockCursor(
  taskId: string,
  trx: Transaction<Database>,
) {
  await trx.insertInto('billingReconciliationCursors')
    .values({ taskId })
    .onConflict(conflict => conflict.column('taskId').doNothing())
    .execute()
  return trx.selectFrom('billingReconciliationCursors')
    .select('cursorOrganizationId')
    .where('taskId', '=', taskId)
    .forUpdate()
    .executeTakeFirstOrThrow()
}

async function advanceCursor(
  input: {
    expectedCursorOrganizationId: null | string
    nextCursorOrganizationId: null | string
    taskId: string
  },
  trx: Transaction<Database>,
) {
  const cursor = await lockCursor(input.taskId, trx)
  if (cursor.cursorOrganizationId !== input.expectedCursorOrganizationId)
    throw new Error('billing_reconciliation_cursor_conflict')
  await trx.updateTable('billingReconciliationCursors')
    .set({
      cursorOrganizationId: input.nextCursorOrganizationId,
      updatedAt: new Date(),
    })
    .where('taskId', '=', input.taskId)
    .execute()
}

/** Reads the next fair page without advancing past unprocessed organizations. */
export async function readSubscriptionGrantReconciliationPage(
  input: ReconciliationPageInput,
  database: DatabaseExecutor,
) {
  assertPageLimit(input.limit)
  return withDatabaseTransaction(database, async (trx) => {
    const cursor = await lockCursor(input.taskId, trx)
    const selectPage = (after: null | string) => {
      let query = trx.selectFrom('billingSubscriptions')
        .select('organizationId')
        .where('paidThrough', 'is not', null)
        .where('status', 'in', ['active', 'past_due', 'trialing', 'unpaid'])
      if (after)
        query = query.where('organizationId', '>', after)
      return query
        .orderBy('organizationId')
        .limit(input.limit)
        .execute()
    }
    let rows = await selectPage(cursor.cursorOrganizationId)
    if (!rows.length && cursor.cursorOrganizationId)
      rows = await selectPage(null)
    const organizationIds = rows.map(row => row.organizationId)
    return {
      expectedCursorOrganizationId: cursor.cursorOrganizationId,
      nextCursorOrganizationId: organizationIds.at(-1) ?? null,
      organizationIds,
    }
  })
}

/** Reads the next fair account page without advancing before verification. */
export async function readBillingInvariantReconciliationPage(
  input: ReconciliationPageInput,
  database: DatabaseExecutor,
) {
  assertPageLimit(input.limit)
  return withDatabaseTransaction(database, async (trx) => {
    const cursor = await lockCursor(input.taskId, trx)
    const selectPage = (after: null | string) => {
      let query = trx.selectFrom('organizationBillingAccounts')
        .select('organizationId')
      if (after)
        query = query.where('organizationId', '>', after)
      return query
        .orderBy('organizationId')
        .limit(input.limit)
        .execute()
    }
    let rows = await selectPage(cursor.cursorOrganizationId)
    if (!rows.length && cursor.cursorOrganizationId)
      rows = await selectPage(null)
    const organizationIds = rows.map(row => row.organizationId)
    return {
      expectedCursorOrganizationId: cursor.cursorOrganizationId,
      nextCursorOrganizationId: organizationIds.at(-1) ?? null,
      organizationIds,
    }
  })
}

/** Advances one reconciliation cursor after its complete page succeeds. */
export async function completeBillingReconciliationPage(input: {
  /** Cursor value observed when the page was read. */
  expectedCursorOrganizationId: null | string
  /** Last successfully processed organization, or null for an empty page. */
  nextCursorOrganizationId: null | string
  /** Stable deployed task identity owning the cursor. */
  taskId: string
}, database: DatabaseExecutor) {
  return withDatabaseTransaction(database, trx => advanceCursor(input, trx))
}
