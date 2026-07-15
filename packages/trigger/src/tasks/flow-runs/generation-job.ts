import type { GenerationOutputType } from '@talelabs/flows'

import { db } from '@talelabs/db'
import {
  FlowRunJobRequestReadError,
  materializeGenerationProviderRequest,
  readFlowRunJobRequestPayload,
} from '@talelabs/flows'
import { schemaTask } from '@trigger.dev/sdk'

import { cleanupUncommittedGeneratedOutputObjects } from '../../generated-output-storage.js'
import { resolveGenerationProviderAdapter } from '../../providers/generation-adapter-registry.js'
import { runGenerationProviderLifecycle } from '../../providers/provider-lifecycle-runner.js'
import { toSafeRunFailure } from '../../run-failure.js'
import {
  GENERATION_JOB_MAX_ATTEMPTS,
  generationJobTaskPayloadSchema,
  generationQueue,
} from './contracts.js'
import {
  assertJobMatchesSnapshotExecutionContract,
  loadSnapshotExecutionContract,
} from './generation-execution-contract.js'
import {
  completeGenerationJob,
  finishSucceededJob,
  getGenerationJobState,
  markJobFailed,
} from './generation-job-state.js'
import { finalizeGenerationOutputs } from './generation-output-finalizer.js'
import { logRunEngine } from './logging.js'
import { materializeJobInputs } from './runtime-inputs.js'
import { expectedSnapshotExecutorVersion } from './snapshot-compatibility.js'

export const generationJobTask = schemaTask({
  id: 'generation-job',
  schema: generationJobTaskPayloadSchema,
  queue: generationQueue,
  retry: {
    factor: 2,
    maxAttempts: GENERATION_JOB_MAX_ATTEMPTS,
    maxTimeoutInMs: 30_000,
    minTimeoutInMs: 1_000,
  },
  catchError: async ({ ctx, error, payload }) => {
    const attemptsExhausted = ctx.attempt.number
      >= (ctx.run.maxAttempts ?? GENERATION_JOB_MAX_ATTEMPTS)
    const failure = toSafeRunFailure(error, 'generation_failed')
    if (attemptsExhausted) {
      await markJobFailed({
        failure,
        jobId: payload.generationJobId,
        organizationId: payload.organizationId,
      })
      await cleanupUncommittedGeneratedOutputObjects({
        generationJobId: payload.generationJobId,
        organizationId: payload.organizationId,
      })
      return
    }
    await db.updateTable('generationJobs')
      .set({
        errorCode: null,
        errorMessage: null,
        providerCostUsd: '0',
        status: 'pending',
      })
      .where('organizationId', '=', payload.organizationId)
      .where('id', '=', payload.generationJobId)
      .where('status', '=', 'running')
      .execute()
    logRunEngine('warn', 'generation_job.retry_scheduled', {
      attempt: ctx.attempt.number,
      generationJobId: payload.generationJobId,
      internalError: failure.internal,
      maxAttempts: ctx.run.maxAttempts ?? GENERATION_JOB_MAX_ATTEMPTS,
      organizationId: payload.organizationId,
    })
  },
  run: async (payload, { ctx }) => {
    const startedAt = performance.now()
    const job = await db.updateTable('generationJobs')
      .set({
        providerCostUsd: '0',
        startedAt: new Date(),
        status: 'running',
        triggerRunId: ctx.run.id,
      })
      .where('organizationId', '=', payload.organizationId)
      .where('id', '=', payload.generationJobId)
      .where('status', '=', 'pending')
      .where(eb => eb.or([
        eb('triggerRunId', 'is', null),
        eb('triggerRunId', '=', ctx.run.id),
      ]))
      .returningAll()
      .executeTakeFirst()
    if (!job) {
      const current = await getGenerationJobState({
        jobId: payload.generationJobId,
        organizationId: payload.organizationId,
      })
      if (current?.status === 'succeeded') {
        return finishSucceededJob({
          flowRunId: current.flowRunId,
          jobId: current.id,
          organizationId: payload.organizationId,
        })
      }
      return { state: 'skipped' as const }
    }

    const run = await db.selectFrom('flowRuns')
      .select(['executorVersion', 'triggerDeploymentVersion'])
      .where('organizationId', '=', payload.organizationId)
      .where('id', '=', job.flowRunId)
      .executeTakeFirst()
    if (!run)
      throw new Error(`flow_run_missing:${job.flowRunId}`)
    const actualDeploymentVersion = ctx.deployment?.version ?? ctx.run.version ?? null
    if (
      run.triggerDeploymentVersion
      && actualDeploymentVersion
      && run.triggerDeploymentVersion !== actualDeploymentVersion
    ) {
      throw new Error('trigger_deployment_version_mismatch')
    }
    if (run.executorVersion !== expectedSnapshotExecutorVersion({
      executorVersion: run.executorVersion,
      isDevelopment: ctx.environment.type === 'DEVELOPMENT',
      triggerDeploymentVersion: run.triggerDeploymentVersion,
    })) {
      throw new Error('job_executor_version_mismatch')
    }

    let requestPayload
    try {
      requestPayload = readFlowRunJobRequestPayload({
        requestHash: job.requestHash,
        requestPayload: job.requestPayload,
      })
    }
    catch (error) {
      await markJobFailed({
        failure: toSafeRunFailure(error, 'invalid_job_request'),
        jobId: job.id,
        organizationId: payload.organizationId,
      })
      logRunEngine('error', 'generation_job.worker.invalid_request', {
        generationJobId: job.id,
        organizationId: payload.organizationId,
        reason: error instanceof FlowRunJobRequestReadError
          ? error.code
          : 'job_request_invalid',
        runId: job.flowRunId,
      })
      return { state: 'failed' as const }
    }

    const executionContract = await loadSnapshotExecutionContract({
      database: db,
      flowRunId: job.flowRunId,
      nodeId: job.nodeId,
      organizationId: payload.organizationId,
    })
    assertJobMatchesSnapshotExecutionContract({
      contract: executionContract,
      job,
      requestPayload,
    })

    const materializedPayload = await materializeJobInputs({
      flowRunId: job.flowRunId,
      jobId: job.id,
      organizationId: payload.organizationId,
      requestPayload,
    })
    await db.updateTable('flowRunNodeItems')
      .set({ status: 'running', updatedAt: new Date() })
      .where('organizationId', '=', payload.organizationId)
      .where('flowRunId', '=', job.flowRunId)
      .where('nodeId', '=', job.nodeId)
      .where('itemKey', '=', job.itemKey)
      .where('status', '<>', 'canceled')
      .execute()

    const providerRequest = materializeGenerationProviderRequest({
      requestId: job.id,
      requestPayload: materializedPayload,
    })
    logRunEngine('info', 'generation_job.provider_request.materialized', {
      generationJobId: job.id,
      inputAssetCount: providerRequest.orderedInputs.reduce(
        (count, requestInput) => count + requestInput.items.reduce(
          (itemCount, item) => itemCount + item.assets.length,
          0,
        ),
        0,
      ),
      inputSlotCount: providerRequest.orderedInputs.length,
      organizationId: payload.organizationId,
      runId: job.flowRunId,
      textSlotCount: providerRequest.textSlots.length,
    })
    const resolvedAdapter = resolveGenerationProviderAdapter({
      adapterVersion: job.adapterVersion,
      modelContractVersion: executionContract.modelContractVersion,
      modelRegistryVersion: job.modelRegistryVersion,
      operationId: job.operation,
      outputType: job.mediaType as GenerationOutputType,
      productModelId: job.model,
      provider: executionContract.provider ?? job.provider,
      providerModel: job.providerModel,
      providerRouteVersion: job.providerRouteVersion,
    })
    logRunEngine('info', 'generation_job.provider_route.resolved', {
      adapterVersion: resolvedAdapter.route.adapterVersion,
      generationJobId: job.id,
      modelContractVersion: resolvedAdapter.route.modelContractVersion,
      modelRegistryVersion: resolvedAdapter.route.modelRegistryVersion,
      operationId: resolvedAdapter.route.operationId,
      organizationId: payload.organizationId,
      productModelId: resolvedAdapter.route.productModelId,
      provider: resolvedAdapter.route.provider,
      providerModel: resolvedAdapter.route.providerModel,
      providerRouteVersion: resolvedAdapter.route.providerRouteVersion,
      runId: job.flowRunId,
    })
    const outputs = await runGenerationProviderLifecycle({
      resolvedAdapter,
      request: providerRequest,
    })
    const finalized = await finalizeGenerationOutputs({
      job: {
        ...job,
        mediaType: job.mediaType as 'audio' | 'image' | 'text' | 'video',
      },
      outputs,
    })
    if (finalized.state !== 'succeeded')
      return finalized
    const completed = await completeGenerationJob({
      job,
      organizationId: payload.organizationId,
    })
    logRunEngine('info', 'generation_job.completed', {
      durationMs: Math.round(performance.now() - startedAt),
      generationJobId: job.id,
      organizationId: payload.organizationId,
      runId: job.flowRunId,
      status: completed.state,
    })
    return completed
  },
})
