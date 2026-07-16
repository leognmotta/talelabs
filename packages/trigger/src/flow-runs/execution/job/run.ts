/**
 * Durable execution path for one admitted generation job.
 *
 * The task verifies captured contracts before crossing the provider spend boundary.
 */

import type { GenerationOutputType } from '@talelabs/flows'
import type { TaskRunContext } from '@trigger.dev/sdk'
import type { GenerationJobTaskPayload } from '../../../tasks/flow-runs/contracts.js'

import { db } from '@talelabs/db'
import {
  FlowRunJobRequestReadError,
  materializeGenerationProviderRequest,
  readFlowRunJobRequestPayload,
} from '@talelabs/flows'
import { runGenerationProviderLifecycle } from '../../../generation/adapters/lifecycle/runner.js'
import { openRouterVideoCallbackUrl } from '../../../generation/adapters/openrouter/video/callback-url.js'
import { resolveGenerationProviderAdapter } from '../../../generation/adapters/registry.js'
import { toSafeRunFailure } from '../../../shared/failures/run-failure.js'
import {
  assertJobMatchesSnapshotExecutionContract,
  loadSnapshotExecutionContext,
} from '../../contracts/execution.js'
import { expectedSnapshotExecutorVersion } from '../../contracts/snapshot.js'
import { logRunEngine } from '../../observability/logging.js'
import { materializeJobInputs } from '../inputs/materialize.js'
import { discardCanceledGenerationResult } from '../outputs/canceled-result.js'
import { finalizeGenerationOutputs } from '../outputs/finalizer.js'
import { generationJobProviderLifecycleOptions } from './provider/lifecycle.js'
import {
  completeGenerationJob,
  finishSucceededJob,
  getGenerationJobState,
  markJobFailed,
  persistProviderFacts,
} from './state/index.js'

/** Executes one tenant-scoped admitted job through final Asset persistence. */
export async function runGenerationJob(
  payload: GenerationJobTaskPayload,
  { ctx }: { ctx: TaskRunContext },
) {
  const startedAt = performance.now()
  const job = await db.updateTable('generationJobs')
    .set({
      startedAt: new Date(),
      status: 'running',
      triggerRunId: ctx.run.id,
    })
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.generationJobId)
    .where('status', 'in', ['pending', 'running'])
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

  const executionContext = await loadSnapshotExecutionContext({
    database: db,
    flowRunId: job.flowRunId,
    nodeId: job.nodeId,
    organizationId: payload.organizationId,
  })
  const executionContract = executionContext.contract
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
    catalogRevision: executionContract.catalogRevision,
    catalogVersion: executionContract.catalogVersion,
    executionMode: executionContext.executionMode,
    modelContractVersion: executionContract.modelContractVersion,
    modelRevision: executionContract.modelRevision,
    operationId: job.operation,
    organizationId: payload.organizationId,
    outputType: job.mediaType as GenerationOutputType,
    productModelId: job.model,
    provider: executionContract.provider,
    providerEndpoint: executionContract.providerEndpoint,
    providerEndpointTag: executionContract.providerEndpointTag,
    providerLifecycle: executionContract.providerLifecycle,
    providerModel: job.providerModel,
    providerRouteVersion: job.providerRouteVersion,
    providerBinding: executionContract.providerBinding,
  })
  logRunEngine('info', 'generation_job.provider_route.resolved', {
    adapterVersion: resolvedAdapter.route.adapterVersion,
    generationJobId: job.id,
    executionMode: executionContext.executionMode,
    modelContractVersion: resolvedAdapter.route.modelContractVersion,
    catalogRevision: resolvedAdapter.route.catalogRevision,
    operationId: resolvedAdapter.route.operationId,
    organizationId: payload.organizationId,
    productModelId: resolvedAdapter.route.productModelId,
    provider: resolvedAdapter.route.provider,
    providerEndpointTag: resolvedAdapter.route.providerEndpointTag ?? null,
    providerModel: resolvedAdapter.route.providerModel,
    providerRouteVersion: resolvedAdapter.route.providerRouteVersion,
    runId: job.flowRunId,
  })
  const callbackUrl = executionContext.executionMode === 'live'
    && resolvedAdapter.route.provider === 'openrouter'
    && resolvedAdapter.route.providerEndpoint === '/api/v1/videos'
    ? openRouterVideoCallbackUrl({
        generationJobId: job.id,
        organizationId: payload.organizationId,
      })
    : undefined
  const providerResult = await runGenerationProviderLifecycle({
    ...generationJobProviderLifecycleOptions({
      context: {
        callbackEnabled: Boolean(callbackUrl),
        expectedOutputCount: providerRequest.outputCount,
        jobId: job.id,
        mediaType: job.mediaType as 'audio' | 'image' | 'text' | 'video',
        organizationId: payload.organizationId,
      },
      providerJobId: job.providerJobId,
      providerSubmittedAt: job.providerSubmittedAt,
      requiresDurableSubmissionBoundary:
        resolvedAdapter.requiresDurableSubmissionBoundary,
    }),
    request: providerRequest,
    resolvedAdapter,
    ...(callbackUrl ? { submissionContext: { callbackUrl } } : {}),
  })
  await persistProviderFacts({
    facts: providerResult.facts,
    jobId: job.id,
    organizationId: payload.organizationId,
  })
  if (await discardCanceledGenerationResult({
    flowRunId: job.flowRunId,
    jobId: job.id,
    organizationId: payload.organizationId,
  })) {
    return { state: 'canceled' as const }
  }
  const finalized = await finalizeGenerationOutputs({
    job: {
      ...job,
      mediaType: job.mediaType as 'audio' | 'image' | 'text' | 'video',
    },
    outputs: providerResult.outputs,
  })
  if (finalized.state !== 'succeeded') {
    await discardCanceledGenerationResult({
      flowRunId: job.flowRunId,
      jobId: job.id,
      organizationId: payload.organizationId,
    })
    return finalized
  }
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
}
