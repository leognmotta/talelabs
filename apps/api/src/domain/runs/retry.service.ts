/** Immutable Flow run retry admission and execution-row cloning. */

import type { JsonValue } from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'
import {
  BROWSER_EXECUTION_ENABLED,
  createFlowRunSnapshotArtifact,
  FLOW_RUN_LIMITS,
  FlowRunSnapshotReadError,
  hashFlowRunRequest,
  readFlowRunSnapshotArtifact,
} from '@talelabs/flows'
import { FLOW_RUN_EXECUTOR_CONTRACT_VERSION } from '@talelabs/trigger'

import { acquireFlowRunAdmissionLocks } from '../../data/flow-run-admission.data.js'
import { localUserIdOrNull } from '../../data/flow-run-planning.data.js'
import { cloneRunExecutionRowsForRetry } from '../../data/run-retry.data.js'
import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import { dispatchFlowRun } from './dispatch.service.js'
import {
  assertFlowRunExecutionModeAuthorized,
  executionModeFromSnapshot,
} from './execution-mode.js'
import { logRunEngine } from './logging.js'
import { getRunDetail } from './read.service.js'

/** Admits a durable retry while preserving or explicitly replacing execution mode. */
export async function retryRun(input: {
  executionMode?: 'debug' | 'live'
  executionRuntime?: 'browser' | 'managed'
  expectedRunStatus?: 'canceled' | 'failed' | 'partial' | 'pending' | 'running' | 'succeeded'
  idempotencyKey: string | null
  isSystemAdmin: boolean
  organizationId: string
  runId: string
  userId: string
}) {
  if (!input.idempotencyKey)
    throw new HttpError(400, 'idempotency_key_required', 'Idempotency-Key is required.')
  const requestHash = hashFlowRunRequest({
    executionMode: input.executionMode ?? null,
    executionRuntime: input.executionRuntime ?? null,
    expectedRunStatus: input.expectedRunStatus ?? null,
    organizationId: input.organizationId,
    requestType: 'flow-run-retry',
    runId: input.runId,
  })
  const existing = await db.selectFrom('flowRuns')
    .select(['id', 'requestHash'])
    .where('organizationId', '=', input.organizationId)
    .where('idempotencyKey', '=', input.idempotencyKey)
    .executeTakeFirst()
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(
        409,
        'idempotency_conflict',
        'Idempotency-Key was already used for a different run request.',
      )
    }
    return getRunDetail(input.organizationId, existing.id)
  }

  const retryRunId = createId()
  const createdBy = await localUserIdOrNull(input.userId)
  let admittedRunId = retryRunId
  let flowId: null | string = null
  await db.transaction().execute(async (trx) => {
    await acquireFlowRunAdmissionLocks(
      trx,
      input.organizationId,
      input.idempotencyKey!,
    )
    const replay = await trx.selectFrom('flowRuns')
      .select(['id', 'requestHash'])
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey!)
      .executeTakeFirst()
    if (replay) {
      if (replay.requestHash !== requestHash) {
        throw new HttpError(
          409,
          'idempotency_conflict',
          'Idempotency-Key was already used for a different run request.',
        )
      }
      admittedRunId = replay.id
      return
    }

    const original = await trx.selectFrom('flowRuns')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .forUpdate()
      .executeTakeFirst()
    if (!original)
      throw new TenantResourceNotFoundError()
    const executionMode = input.executionMode
      ?? executionModeFromSnapshot(original.graphSnapshot)
    const executionRuntime = input.executionRuntime ?? original.executionRuntime
    if (executionRuntime === 'browser' && !BROWSER_EXECUTION_ENABLED)
      throw new HttpError(409, 'invalid_execution_runtime', 'Browser execution is unavailable.')
    assertFlowRunExecutionModeAuthorized(executionMode, input.isSystemAdmin)
    flowId = original.flowId
    if (input.expectedRunStatus && original.status !== input.expectedRunStatus) {
      throw new HttpError(
        409,
        'run_status_changed',
        'The run status changed before retry admission.',
      )
    }
    if (!['failed', 'partial', 'canceled'].includes(original.status)) {
      throw new HttpError(
        409,
        'invalid_state',
        'Only failed, partial, or canceled runs can be retried.',
      )
    }
    const unsettledProviderJob = await trx.selectFrom('generationJobs')
      .select(['id', 'providerSettlementStatus'])
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('providerSettlementStatus', 'in', ['pending', 'unknown'])
      .executeTakeFirst()
    const incompleteProviderCheckpoint = await trx
      .selectFrom('generationProviderOutputs as output')
      .innerJoin('generationJobs as job', join => join
        .onRef('job.id', '=', 'output.jobId')
        .onRef('job.organizationId', '=', 'output.organizationId'))
      .select('output.outputIndex')
      .where('job.organizationId', '=', input.organizationId)
      .where('job.flowRunId', '=', input.runId)
      .where('output.status', '=', 'staging')
      .executeTakeFirst()
    if (unsettledProviderJob || incompleteProviderCheckpoint) {
      throw new HttpError(
        409,
        'provider_settlement_incomplete',
        'This run cannot be retried until submitted provider work is financially settled.',
      )
    }

    let sourceSnapshot
    try {
      sourceSnapshot = readFlowRunSnapshotArtifact({
        executorVersion: original.executorVersion,
        expectedExecutorVersion: original.executorVersion,
        graphSnapshot: original.graphSnapshot,
        snapshotHash: original.snapshotHash,
        snapshotVersion: original.snapshotVersion,
      })
    }
    catch (error) {
      const reason = error instanceof FlowRunSnapshotReadError
        ? error.code
        : 'snapshot_invalid'
      logRunEngine('warn', 'flow_run.retry.snapshot_unavailable', {
        organizationId: input.organizationId,
        reason,
        retryOfRunId: input.runId,
      })
      throw new HttpError(
        409,
        'retry_not_available',
        'This run snapshot is not compatible with the current executor.',
      )
    }
    const retrySnapshot = createFlowRunSnapshotArtifact({
      ...sourceSnapshot.snapshot,
      executionMode,
      executionRuntime,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
    })
    if (
      executionMode === 'live'
      && sourceSnapshot.snapshot.executionContracts.some(contract => (
        !contract.providerBinding.executionRuntimes.includes(executionRuntime)
      ))
    ) {
      throw new HttpError(
        409,
        'generation_provider_route_unavailable',
        'The captured provider route does not support the selected runtime.',
      )
    }

    const activeRunCount = await trx.selectFrom('flowRuns')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('status', 'in', ['pending', 'running'])
      .executeTakeFirst()
    if (Number(activeRunCount?.count ?? 0) >= FLOW_RUN_LIMITS.organizationActiveRuns) {
      throw new HttpError(
        429,
        'organization_run_capacity_exceeded',
        'This organization has too many active Flow runs.',
      )
    }

    const inputAssetIds = await trx.selectFrom('generationJobs as job')
      .innerJoin('generationJobInputs as input', join => join
        .onRef('input.jobId', '=', 'job.id')
        .onRef('input.organizationId', '=', 'job.organizationId'))
      .innerJoin('assets as inputAsset', join => join
        .onRef('inputAsset.id', '=', 'input.assetId')
        .onRef('inputAsset.organizationId', '=', 'input.organizationId'))
      .leftJoin('generationJobs as producer', join => join
        .onRef('producer.id', '=', 'inputAsset.generationJobId')
        .onRef('producer.organizationId', '=', 'inputAsset.organizationId'))
      .select(['input.assetId', 'producer.flowRunId as producerFlowRunId'])
      .distinct()
      .where('job.organizationId', '=', input.organizationId)
      .where('job.flowRunId', '=', input.runId)
      .execute()
    const externalAssetIds = inputAssetIds
      .filter(row => row.producerFlowRunId !== input.runId)
      .map(row => row.assetId)
    if (externalAssetIds.length) {
      const usableAssets = await trx.selectFrom('assets')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('id', 'in', externalAssetIds)
        .where('processingState', '=', 'ready')
        .where('deletedAt', 'is', null)
        .where('purgeRequestedAt', 'is', null)
        .where('purgedAt', 'is', null)
        .forUpdate()
        .execute()
      const usableIds = new Set(usableAssets.map(asset => asset.id))
      const missingId = externalAssetIds.find(assetId => !usableIds.has(assetId))
      if (missingId) {
        throw new HttpError(
          409,
          'invalid_state',
          'A captured run input Asset is not ready for retry.',
        )
      }
    }

    await trx.insertInto('flowRuns').values({
      browserExecutorStatus: executionRuntime === 'browser' ? 'ready' : null,
      browserExecutorUpdatedAt: executionRuntime === 'browser' ? new Date() : null,
      createdBy,
      executorVersion: FLOW_RUN_EXECUTOR_CONTRACT_VERSION,
      flowId: original.flowId,
      executionRuntime,
      graphSnapshot: retrySnapshot.snapshot as unknown as JsonValue,
      id: retryRunId,
      idempotencyKey: input.idempotencyKey!,
      mode: original.mode,
      organizationId: input.organizationId,
      requestHash,
      retryOfRunId: original.id,
      snapshotHash: retrySnapshot.hash,
      snapshotVersion: retrySnapshot.snapshot.snapshotVersion,
      status: 'pending',
      targetNodeId: original.targetNodeId,
    }).execute()
    await cloneRunExecutionRowsForRetry({
      createdBy,
      organizationId: input.organizationId,
      retryRunId,
      sourceRunId: input.runId,
      trx,
    })
  })

  const admittedRuntime = await db.selectFrom('flowRuns')
    .select('executionRuntime')
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', admittedRunId)
    .executeTakeFirst()
  if (admittedRunId === retryRunId && admittedRuntime?.executionRuntime === 'managed') {
    await dispatchFlowRun({
      eventPrefix: 'flow_run.retry',
      flowId,
      organizationId: input.organizationId,
      runId: retryRunId,
    })
  }
  return getRunDetail(input.organizationId, admittedRunId)
}
