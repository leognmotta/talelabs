/** PostgreSQL-authoritative ownership for browser-executed Flow runs. */

import { db, sql } from '@talelabs/db'

import {
  HttpError,
  TenantResourceNotFoundError,
} from '../../../middleware/error.js'
import {
  BROWSER_RUN_LEASE_DURATION_MS,
  lockBrowserRunFence,
} from './browser-runtime-policy.js'

/** Acquires or renews a browser run lease without permitting active takeover. */
export async function acquireBrowserRunLease(input: {
  executorId: string
  organizationId: string
  runId: string
  userId: string
}) {
  return db.transaction().execute(async (trx) => {
    await lockBrowserRunFence(trx, input)
    const run = await trx
      .selectFrom('flowRuns')
      .select([
        'cancellationReconciledAt',
        'createdBy',
        'executionRuntime',
        'status',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .forUpdate()
      .executeTakeFirst()
    if (!run)
      throw new TenantResourceNotFoundError()
    if (run.createdBy !== input.userId)
      throw new TenantResourceNotFoundError()
    if (run.executionRuntime !== 'browser') {
      throw new HttpError(
        409,
        'invalid_execution_runtime',
        'This run is not browser-executed.',
      )
    }
    if (
      !['pending', 'running'].includes(run.status)
      && !(run.status === 'canceled' && run.cancellationReconciledAt === null)
    ) {
      throw new HttpError(409, 'run_terminal', 'This run is already terminal.')
    }
    const current = await trx
      .selectFrom('flowRunBrowserLeases')
      .selectAll()
      .select(sql<boolean>`"leaseExpiresAt" > now()`.as('isActive'))
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .forUpdate()
      .executeTakeFirst()
    if (
      current
      && current.isActive
      && (current.executorId !== input.executorId
        || current.userId !== input.userId)
    ) {
      throw new HttpError(
        409,
        'browser_run_already_leased',
        'Another browser owns this run.',
      )
    }
    const leaseExpiresAt = sql<Date>`now() + (${BROWSER_RUN_LEASE_DURATION_MS} * interval '1 millisecond')`
    const fenceToken = current
      ? current.isActive
        ? current.fenceToken
        : current.fenceToken + 1
      : 1
    const lease = await trx
      .insertInto('flowRunBrowserLeases')
      .values({
        executorId: input.executorId,
        fenceToken,
        flowRunId: input.runId,
        heartbeatAt: sql`now()`,
        leaseExpiresAt,
        organizationId: input.organizationId,
        updatedAt: sql`now()`,
        userId: input.userId,
      })
      .onConflict(conflict =>
        conflict.columns(['organizationId', 'flowRunId']).doUpdateSet({
          executorId: input.executorId,
          fenceToken,
          heartbeatAt: sql`now()`,
          leaseExpiresAt,
          updatedAt: sql`now()`,
          userId: input.userId,
        }),
      )
      .returning(['executorId', 'fenceToken', 'leaseExpiresAt'])
      .executeTakeFirstOrThrow()
    return {
      executorId: lease.executorId,
      fenceToken: lease.fenceToken,
      leaseExpiresAt: lease.leaseExpiresAt.toISOString(),
    }
  })
}

/** Releases only the caller's current browser run lease. */
export async function releaseBrowserRunLease(input: {
  executorId: string
  fenceToken: number
  organizationId: string
  runId: string
  userId: string
}) {
  return db.transaction().execute(async (trx) => {
    await lockBrowserRunFence(trx, input)
    const result = await trx
      .updateTable('flowRunBrowserLeases')
      .set({
        heartbeatAt: sql`now()`,
        leaseExpiresAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('executorId', '=', input.executorId)
      .where('fenceToken', '=', input.fenceToken)
      .where('userId', '=', input.userId)
      .executeTakeFirst()
    return { released: Number(result.numUpdatedRows) > 0 }
  })
}

/** Removes a lease after authoritative aggregation makes its run terminal. */
export async function retireBrowserRunLeaseIfTerminal(input: {
  organizationId: string
  runId: string
}) {
  await db
    .deleteFrom('flowRunBrowserLeases')
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.runId)
    .where(eb =>
      eb.exists(
        eb
          .selectFrom('flowRuns')
          .select('id')
          .whereRef(
            'flowRuns.organizationId',
            '=',
            'flowRunBrowserLeases.organizationId',
          )
          .whereRef('flowRuns.id', '=', 'flowRunBrowserLeases.flowRunId')
          .where(eb =>
            eb.or([
              eb('flowRuns.status', 'in', ['succeeded', 'partial', 'failed']),
              eb.and([
                eb('flowRuns.status', '=', 'canceled'),
                eb('flowRuns.cancellationReconciledAt', 'is not', null),
              ]),
            ]),
          ),
      ),
    )
    .execute()
}
