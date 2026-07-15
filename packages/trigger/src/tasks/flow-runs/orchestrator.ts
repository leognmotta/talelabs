import { db } from '@talelabs/db'
import { FlowRunSnapshotReadError, readFlowRunSnapshotArtifact } from '@talelabs/flows'
import { metadata, schemaTask } from '@trigger.dev/sdk'

import {
  aggregateFlowRunState,
  claimFlowRunTriggerParent,
} from '../../flow-run-state.js'
import { cleanupUncommittedGeneratedOutputObjectsForRun } from '../../generated-output-storage.js'
import { toSafeRunFailure } from '../../run-failure.js'
import {
  flowRunQueue,
  flowRunTaskPayloadSchema,
  generationJobTriggerOptions,
} from './contracts.js'
import { generationJobTask } from './generation-job.js'
import { skipDescendants } from './graph-failure.js'
import { logRunEngine } from './logging.js'
import { expectedSnapshotExecutorVersion } from './snapshot-compatibility.js'

export const flowRunOrchestratorTask = schemaTask({
  id: 'flow-run-orchestrator',
  schema: flowRunTaskPayloadSchema,
  queue: flowRunQueue,
  retry: {
    factor: 2,
    maxAttempts: 3,
    maxTimeoutInMs: 30_000,
    minTimeoutInMs: 1_000,
  },
  onFailure: async ({ ctx, error, payload }) => {
    const ownedRun = await db.selectFrom('flowRuns')
      .select('id')
      .where('organizationId', '=', payload.organizationId)
      .where('id', '=', payload.flowRunId)
      .where('status', 'in', ['pending', 'running'])
      .where('triggerRunId', '=', ctx.run.id)
      .executeTakeFirst()
    if (!ownedRun)
      return
    const failure = toSafeRunFailure(error, 'trigger_parent_failed')
    logRunEngine('error', 'flow_run.worker.failed', {
      internalError: failure.internal,
      organizationId: payload.organizationId,
      runId: payload.flowRunId,
      triggerRunId: ctx.run.id,
    })
    await db.updateTable('generationJobs')
      .set({
        completedAt: new Date(),
        errorCode: failure.code,
        errorMessage: failure.message,
        status: 'failed',
      })
      .where('organizationId', '=', payload.organizationId)
      .where('flowRunId', '=', payload.flowRunId)
      .where('status', 'in', ['pending', 'running'])
      .execute()
    await cleanupUncommittedGeneratedOutputObjectsForRun({
      flowRunId: payload.flowRunId,
      organizationId: payload.organizationId,
    })
    await aggregateFlowRunState(payload.organizationId, payload.flowRunId)
  },
  run: async (payload, { ctx }) => {
    const startedAt = performance.now()
    const triggerDeploymentVersion = ctx.deployment?.version ?? ctx.run.version ?? null
    const claimed = await claimFlowRunTriggerParent({
      flowRunId: payload.flowRunId,
      organizationId: payload.organizationId,
      triggerDeploymentVersion,
      triggerRunId: ctx.run.id,
    })
    const run = claimed
      ? await db.updateTable('flowRuns')
          .set({ startedAt: new Date(), status: 'running' })
          .where('organizationId', '=', payload.organizationId)
          .where('id', '=', payload.flowRunId)
          .where('status', 'in', ['pending', 'running'])
          .where('triggerRunId', '=', ctx.run.id)
          .returningAll()
          .executeTakeFirst()
      : undefined
    if (!run) {
      const current = await db.selectFrom('flowRuns')
        .select(['id', 'status', 'triggerRunId'])
        .where('organizationId', '=', payload.organizationId)
        .where('id', '=', payload.flowRunId)
        .executeTakeFirst()
      return { state: current ? 'already-started' as const : 'missing' as const }
    }

    let snapshotArtifact
    try {
      snapshotArtifact = readFlowRunSnapshotArtifact({
        executorVersion: run.executorVersion,
        expectedExecutorVersion: expectedSnapshotExecutorVersion({
          executorVersion: run.executorVersion,
          isDevelopment: ctx.environment.type === 'DEVELOPMENT',
          triggerDeploymentVersion: run.triggerDeploymentVersion,
        }),
        graphSnapshot: run.graphSnapshot,
        snapshotHash: run.snapshotHash,
        snapshotVersion: run.snapshotVersion,
      })
    }
    catch (error) {
      const reason = error instanceof FlowRunSnapshotReadError
        ? error.code
        : 'snapshot_invalid'
      const now = new Date()
      await db.updateTable('generationJobs')
        .set({
          completedAt: now,
          errorCode: 'invalid_snapshot',
          errorMessage: 'Run snapshot integrity or executor compatibility validation failed.',
          status: 'failed',
        })
        .where('organizationId', '=', payload.organizationId)
        .where('flowRunId', '=', payload.flowRunId)
        .where('status', 'in', ['pending', 'running'])
        .execute()
      await aggregateFlowRunState(payload.organizationId, payload.flowRunId)
      await db.updateTable('flowRuns')
        .set({
          completedAt: now,
          errorCode: 'invalid_snapshot',
          errorMessage: 'Run snapshot integrity or executor compatibility validation failed.',
          status: 'failed',
        })
        .where('organizationId', '=', payload.organizationId)
        .where('id', '=', payload.flowRunId)
        .where('status', 'in', ['pending', 'running'])
        .execute()
      logRunEngine('error', 'flow_run.worker.invalid_snapshot', {
        organizationId: payload.organizationId,
        reason,
        runId: payload.flowRunId,
        triggerRunId: ctx.run.id,
      })
      return { state: 'failed' as const }
    }

    const snapshot = snapshotArtifact.snapshot
    const plannedJobCount = snapshot.plan.summary.plannedJobCount
    let completedJobCount = 0
    let failedJobCount = 0
    let stateVersion = 0
    const updateRealtimeMetadata = (status: 'completed' | 'failed' | 'running') => {
      stateVersion += 1
      metadata
        .set('flowRunId', payload.flowRunId)
        .set('completedJobs', completedJobCount)
        .set('failedJobs', failedJobCount)
        .set('stateVersion', stateVersion)
        .set('status', status)
        .set('totalJobs', plannedJobCount)
    }
    updateRealtimeMetadata('running')

    for (const [levelIndex, level] of snapshot.plan.topologicalLevels.entries()) {
      const active = await db.selectFrom('flowRuns')
        .select('status')
        .where('organizationId', '=', payload.organizationId)
        .where('id', '=', payload.flowRunId)
        .executeTakeFirst()
      if (!active || active.status === 'canceled')
        return { state: 'canceled' as const }

      const jobs = await db.selectFrom('generationJobs')
        .select('id')
        .where('organizationId', '=', payload.organizationId)
        .where('flowRunId', '=', payload.flowRunId)
        .where('nodeId', 'in', level)
        .where('status', '=', 'pending')
        .orderBy('createdAt')
        .orderBy('id')
        .execute()
      if (!jobs.length)
        continue

      const batchItems = []
      for (const job of jobs) {
        batchItems.push({
          options: await generationJobTriggerOptions(payload.organizationId, job.id),
          payload: {
            generationJobId: job.id,
            organizationId: payload.organizationId,
          },
        })
      }
      const results = await generationJobTask.batchTriggerAndWait(batchItems)
      const failedJobIds = results.runs
        .map((result, index) => ({ jobId: jobs[index]!.id, result }))
        .filter(({ result }) => !result.ok || result.output?.state !== 'succeeded')
        .map(({ jobId }) => jobId)
      const failedCount = failedJobIds.length
      completedJobCount += results.runs.length - failedCount
      failedJobCount += failedCount
      logRunEngine(failedCount > 0 ? 'warn' : 'info', 'flow_run.worker.level.completed', {
        failedCount,
        jobCount: jobs.length,
        levelIndex,
        okCount: results.runs.length - failedCount,
        organizationId: payload.organizationId,
        runId: payload.flowRunId,
        triggerRunId: ctx.run.id,
      })
      updateRealtimeMetadata(failedCount > 0 ? 'failed' : 'running')
      if (failedCount > 0) {
        const failedNodes = await db.selectFrom('generationJobs')
          .select('nodeId')
          .where('organizationId', '=', payload.organizationId)
          .where('id', 'in', failedJobIds)
          .execute()
        await skipDescendants({
          failedNodeIds: [...new Set(failedNodes.map(job => job.nodeId))],
          flowRunId: payload.flowRunId,
          graphSnapshot: snapshot,
          organizationId: payload.organizationId,
        })
        await aggregateFlowRunState(payload.organizationId, payload.flowRunId)
      }
    }
    await aggregateFlowRunState(payload.organizationId, payload.flowRunId)
    updateRealtimeMetadata('completed')
    logRunEngine('info', 'flow_run.worker.completed', {
      durationMs: Math.round(performance.now() - startedAt),
      organizationId: payload.organizationId,
      runId: payload.flowRunId,
      triggerRunId: ctx.run.id,
    })
    return { state: 'completed' as const }
  },
})
