/** Code-owned browser execution limits and lease validation policy. */

import type { Database, Transaction } from '@talelabs/db'

import { db, sql } from '@talelabs/db'
import {
  readFlowRunExecutionRuntime,
  readFlowRunSnapshotArtifact,
} from '@talelabs/flows'
import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '@talelabs/trigger'

import {
  HttpError,
  TenantResourceNotFoundError,
} from '../../../middleware/error.js'

/** Browser lease duration renewed by the active layout-scoped executor. */
export const BROWSER_RUN_LEASE_DURATION_MS = 45_000
/** Maximum jobs returned by one bounded fair scheduler claim. */
export const BROWSER_RUN_MAX_CLAIM_COUNT = 4
/** Maximum locally scheduled attempts before browser failure becomes terminal. */
export const BROWSER_JOB_MAX_ATTEMPTS = 3
/** Default backoff in milliseconds for safe browser provider retries. */
export const BROWSER_JOB_DEFAULT_RETRY_MS = 5_000
/** Maximum persisted provider-directed browser retry delay in milliseconds. */
export const BROWSER_JOB_MAX_RETRY_MS = 5 * 60 * 1_000

/**
 * Serializes lease ownership changes and fenced operations without locking rows
 * that canonical finalization may need through a separate database connection.
 */
export async function lockBrowserRunFence(
  trx: Transaction<Database>,
  input: { organizationId: string, runId: string },
) {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`${input.organizationId}:${input.runId}`}, 0)
    )
  `.execute(trx)
}

/**
 * Acquires the current run fence inside a canonical output transaction and
 * rejects a stale executor before it can insert text or an Asset.
 */
export async function assertBrowserJobOutputCommit(
  input: BrowserRunLeaseActor & { jobId: string },
  trx: Transaction<Database>,
) {
  await lockBrowserRunFence(trx, input)
  const owned = await trx
    .selectFrom('generationJobs as job')
    .innerJoin('flowRuns as run', join => join
      .onRef('run.organizationId', '=', 'job.organizationId')
      .onRef('run.id', '=', 'job.flowRunId'))
    .innerJoin('flowRunBrowserLeases as lease', join => join
      .onRef('lease.organizationId', '=', 'run.organizationId')
      .onRef('lease.flowRunId', '=', 'run.id'))
    .select('job.id')
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', '=', input.runId)
    .where('job.id', '=', input.jobId)
    .where('job.status', '=', 'running')
    .where('job.browserFenceToken', '=', input.fenceToken)
    .where('run.createdBy', '=', input.userId)
    .where('run.executionRuntime', '=', 'browser')
    .where('lease.executorId', '=', input.executorId)
    .where('lease.fenceToken', '=', input.fenceToken)
    .where('lease.userId', '=', input.userId)
    .where('lease.leaseExpiresAt', '>', trx.fn<Date>('now'))
    .where(eb => eb.or([
      eb('run.status', 'in', ['pending', 'running']),
      eb.and([
        eb('run.status', '=', 'canceled'),
        eb('run.cancellationReconciledAt', 'is', null),
      ]),
    ]))
    .executeTakeFirst()
  if (!owned) {
    throw new HttpError(
      409,
      'browser_run_lease_lost',
      'Browser job ownership is no longer active.',
    )
  }
}

/** Identity required by every fenced browser-run operation after acquisition. */
export interface BrowserRunLeaseActor {
  /** Tab-scoped executor identity that acquired the lease. */
  executorId: string
  /** Monotonic ownership generation returned by lease acquisition. */
  fenceToken: number
  /** Tenant that owns the run and lease. */
  organizationId: string
  /** Browser-executed run under lease. */
  runId: string
  /** Authenticated creator allowed to exercise the browser lease. */
  userId: string
}

/** Integrity-checked run state retained while the advisory fence is held. */
export interface BrowserRunLeaseContext {
  /** Parsed immutable snapshot artifact selected by the admitted run. */
  artifact: ReturnType<typeof readFlowRunSnapshotArtifact>
  /** Cancellation reconciliation instant, null while browser work remains. */
  cancellationReconciledAt: Date | null
  /** Monotonic lease generation matched by the request. */
  fenceToken: number
  /** Saved Flow identifier retained for diagnostics and output ownership. */
  flowId: string | null
  /** Durable Flow run identifier. */
  id: string
  /** Current lease expiry authored by PostgreSQL. */
  leaseExpiresAt: Date
  /** Hash of the immutable snapshot artifact. */
  snapshotHash: string
  /** Current durable run lifecycle status. */
  status:
    | 'canceled'
    | 'failed'
    | 'partial'
    | 'pending'
    | 'running'
    | 'succeeded'
}

/**
 * Holds the run-scoped advisory fence while one server operation mutates state.
 * The operation receives the fence transaction and must execute every database
 * statement on it: the pool is small, and a second connection acquired while
 * this one is held can deadlock concurrent fenced operations.
 */
export async function withBrowserRunLease<Result>(
  input: BrowserRunLeaseActor,
  operation: (
    run: BrowserRunLeaseContext,
    trx: Transaction<Database>,
  ) => Promise<Result>,
): Promise<Result> {
  return db.transaction().execute(async (trx) => {
    await lockBrowserRunFence(trx, input)
    const row = await trx
      .selectFrom('flowRuns as run')
      .innerJoin('flowRunBrowserLeases as lease', join =>
        join
          .onRef('lease.organizationId', '=', 'run.organizationId')
          .onRef('lease.flowRunId', '=', 'run.id'))
      .select([
        'lease.fenceToken',
        'lease.leaseExpiresAt',
        'run.cancellationReconciledAt',
        'run.executorVersion',
        'run.flowId',
        'run.graphSnapshot',
        'run.id',
        'run.snapshotHash',
        'run.snapshotVersion',
        'run.status',
      ])
      .where('run.organizationId', '=', input.organizationId)
      .where('run.id', '=', input.runId)
      .where('run.createdBy', '=', input.userId)
      .where('run.executionRuntime', '=', 'browser')
      .where('lease.executorId', '=', input.executorId)
      .where('lease.fenceToken', '=', input.fenceToken)
      .where('lease.userId', '=', input.userId)
      .where('lease.leaseExpiresAt', '>', trx.fn<Date>('now'))
      .where(eb =>
        eb.or([
          eb('run.status', 'in', ['pending', 'running']),
          eb.and([
            eb('run.status', '=', 'canceled'),
            eb('run.cancellationReconciledAt', 'is', null),
          ]),
        ]),
      )
      .executeTakeFirst()
    if (!row) {
      const exists = await trx
        .selectFrom('flowRuns')
        .select(['cancellationReconciledAt', 'id', 'status'])
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.runId)
        .where('createdBy', '=', input.userId)
        .executeTakeFirst()
      if (!exists)
        throw new TenantResourceNotFoundError()
      const terminal
        = ['succeeded', 'partial', 'failed'].includes(exists.status)
          || (exists.status === 'canceled'
            && exists.cancellationReconciledAt !== null)
      if (terminal) {
        throw new HttpError(
          409,
          'run_terminal',
          'This run is already terminal.',
        )
      }
      throw new HttpError(
        409,
        'browser_run_lease_lost',
        'Browser run ownership is no longer active.',
      )
    }
    let artifact: ReturnType<typeof readFlowRunSnapshotArtifact>
    try {
      artifact = readFlowRunSnapshotArtifact({
        executorVersion: row.executorVersion,
        expectedExecutorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
        graphSnapshot: row.graphSnapshot,
        snapshotHash: row.snapshotHash,
        snapshotVersion: row.snapshotVersion,
      })
      if (
        readFlowRunExecutionRuntime(artifact.snapshot.executionRuntime)
        !== 'browser'
      ) {
        throw new Error('browser_snapshot_runtime_mismatch')
      }
    }
    catch {
      throw new HttpError(
        409,
        'invalid_snapshot',
        'The browser run snapshot is invalid.',
      )
    }
    return operation({
      artifact,
      cancellationReconciledAt: row.cancellationReconciledAt,
      fenceToken: row.fenceToken,
      flowId: row.flowId,
      id: row.id,
      leaseExpiresAt: row.leaseExpiresAt,
      snapshotHash: row.snapshotHash,
      status: row.status,
    }, trx)
  })
}

/** Requires a current tenant-scoped lease owned by the supplied fence token. */
export async function requireBrowserRunLease(input: BrowserRunLeaseActor) {
  return withBrowserRunLease(input, async run => run)
}
