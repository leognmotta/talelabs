/** Dependency-aware claiming and materialization for leased browser jobs. */

import type { Database, Transaction } from '@talelabs/db'
import type {
  ExecutionPlan,
  FlowRunSnapshot,
  NormalizedGenerationMediaAsset,
  ReadableFlowRunPlanSnapshot,
} from '@talelabs/flows'

import { db, sql } from '@talelabs/db'
import {
  BrowserRunClaimedJobSchema,
  materializeGenerationProviderRequest,
  readFlowRunExecutionMode,
  readFlowRunJobRequestPayload,
  toBrowserExecutionContract,
} from '@talelabs/flows'
import { isBrowserExecutableProviderBinding } from '@talelabs/models-catalog'
import { createDownloadUrl } from '@talelabs/storage'
import {
  aggregateFlowRunState,
  assertJobMatchesSnapshotExecutionContract,
  createDeterministicMockTextOutput,
  createGenerationAssetResolver,
  loadSnapshotExecutionContext,
  markJobFailed,
  materializeJobInputs,
  selectMockGenerationFixture,
  skipDescendants,
  toSafeRunFailure,
} from '@talelabs/trigger'

import { retireBrowserRunLeaseIfTerminal } from './browser-lease.service.js'
import {
  readBrowserJobOutputReadiness,
  settleReadyBrowserJob,
} from './browser-output-readiness.service.js'
import {
  BROWSER_RUN_MAX_CLAIM_COUNT,
  withBrowserRunLease,
} from './browser-runtime-policy.js'

async function selectClaimCandidates(input: {
  activeJobIds: string[]
  limit: number
  organizationId: string
  plan: ExecutionPlan
  runId: string
  trx: Transaction<Database>
}) {
  const [jobs, nodes] = await Promise.all([
    input.trx
      .selectFrom('generationJobs')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .where('status', 'in', ['pending', 'running'])
      .where(eb =>
        eb.or([
          eb('browserNextEligibleAt', 'is', null),
          eb('browserNextEligibleAt', '<=', sql<Date>`now()`),
        ]),
      )
      .orderBy('startedAt', 'asc')
      .orderBy('createdAt')
      .orderBy('id')
      .execute(),
    input.trx
      .selectFrom('flowRunNodes')
      .select(['nodeId', 'status'])
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.runId)
      .execute(),
  ])
  const executionNodeIds = new Set<string>(
    input.plan.steps.map(step => step.stepId),
  )
  const activeJobIds = new Set(input.activeJobIds)
  const nodeStatus = new Map(nodes.map(node => [node.nodeId, node.status]))
  const predecessors = new Map<string, string[]>()
  for (const edge of input.plan.dependencies) {
    if (
      executionNodeIds.has(edge.sourceStepId)
      && executionNodeIds.has(edge.targetStepId)
    ) {
      predecessors.set(edge.targetStepId, [
        ...(predecessors.get(edge.targetStepId) ?? []),
        edge.sourceStepId,
      ])
    }
  }
  return jobs
    .filter(
      job =>
        !activeJobIds.has(job.id)
        && job.browserSubmissionState !== 'submitting'
        && !(
          job.browserSubmissionState === 'submitted'
          && job.providerJobId === null
        )
        && (job.status === 'running'
          || (predecessors
            .get(job.nodeId)
            ?.every(nodeId => nodeStatus.get(nodeId) === 'succeeded')
            ?? true)),
    )
    .slice(0, input.limit)
}

async function createDebugOutputs(input: {
  mediaType: 'audio' | 'image' | 'text' | 'video'
  outputCount: number
}) {
  const outputs = []
  for (let outputIndex = 0; outputIndex < input.outputCount; outputIndex += 1) {
    if (input.mediaType === 'text') {
      const output = await createDeterministicMockTextOutput(outputIndex)
      if (output.payload.delivery !== 'text')
        throw new Error('debug_text_output_invalid')
      outputs.push({
        delivery: 'text' as const,
        mimeType: output.payload.mimeType,
        outputIndex,
        text: output.payload.text,
      })
      continue
    }
    const fixture = selectMockGenerationFixture({
      mediaType: input.mediaType,
      outputIndex,
    })
    outputs.push({
      delivery: 'url' as const,
      metadata: {
        fixtureCatalogVersion: fixture.catalogVersion,
        fixtureChecksumSha256: fixture.checksumSha256,
        fixtureId: fixture.id,
        ...(fixture.durationSeconds === undefined
          ? {}
          : { durationSeconds: fixture.durationSeconds }),
        ...(fixture.height === undefined ? {} : { height: fixture.height }),
        ...(fixture.width === undefined ? {} : { width: fixture.width }),
      },
      mimeType: fixture.mimeType,
      outputIndex,
      url: await createDownloadUrl({
        bucket: fixture.storage.bucket,
        expiresIn: 300,
        key: fixture.storage.key,
        responseContentType: fixture.mimeType,
      }),
    })
  }
  return outputs
}

async function materializeClaimedJob(input: {
  fenceToken: number
  job: Awaited<ReturnType<typeof selectClaimCandidates>>[number]
  organizationId: string
  snapshot: FlowRunSnapshot<ReadableFlowRunPlanSnapshot>
  trx: Transaction<Database>
}) {
  const requestPayload = readFlowRunJobRequestPayload({
    requestHash: input.job.requestHash,
    requestPayload: input.job.requestPayload,
  })
  const execution = await loadSnapshotExecutionContext({
    database: input.trx,
    flowRunId: input.job.flowRunId,
    nodeId: input.job.nodeId,
    organizationId: input.organizationId,
  })
  assertJobMatchesSnapshotExecutionContract({
    contract: execution.contract,
    job: input.job,
    requestPayload,
  })
  const binding = execution.contract.providerBinding
  if (
    execution.executionMode === 'live'
    && (!binding.executionRuntimes.includes('browser')
      || !isBrowserExecutableProviderBinding(binding))
  ) {
    // The reviewed binding cannot run in a browser; fail before any paid
    // submission instead of handing the claim to the executor.
    if (
      await markJobFailed(
        {
          failure: toSafeRunFailure(
            new Error('invalid_snapshot'),
            'invalid_snapshot',
          ),
          jobId: input.job.id,
          organizationId: input.organizationId,
        },
        input.trx,
      )
    ) {
      await skipDescendants(
        {
          failedNodeIds: [input.job.nodeId],
          flowRunId: input.job.flowRunId,
          graphSnapshot: input.snapshot,
          organizationId: input.organizationId,
        },
        input.trx,
      )
      await aggregateFlowRunState(
        input.organizationId,
        input.job.flowRunId,
        input.trx,
      )
    }
    return null
  }
  const claimed = await input.trx
    .updateTable('generationJobs')
    .set({
      browserAttemptCount:
        input.job.status === 'pending'
          ? sql`"browserAttemptCount" + 1`
          : input.job.browserAttemptCount,
      browserNextEligibleAt: null,
      browserFenceToken: input.fenceToken,
      startedAt: input.job.startedAt ?? new Date(),
      status: 'running',
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.job.id)
    .where('status', '=', input.job.status)
    .returningAll()
    .executeTakeFirst()
  if (!claimed)
    return null
  const materialized = await materializeJobInputs(
    {
      flowRunId: claimed.flowRunId,
      jobId: claimed.id,
      organizationId: input.organizationId,
      requestPayload,
    },
    input.trx,
  )
  const request = materializeGenerationProviderRequest({
    requestId: claimed.id,
    requestPayload: materialized,
  })
  const references = new Map<string, NormalizedGenerationMediaAsset>()
  for (const orderedInput of request.orderedInputs) {
    for (const item of orderedInput.items) {
      for (const asset of item.assets) references.set(asset.assetId, asset)
    }
  }
  const resolveAsset = createGenerationAssetResolver(
    input.organizationId,
    input.trx,
  )
  const inputAssets = []
  for (const reference of references.values())
    inputAssets.push(await resolveAsset(reference))
  await input.trx
    .updateTable('flowRuns')
    .set({ startedAt: new Date(), status: 'running' })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', claimed.flowRunId)
    .where('status', '=', 'pending')
    .execute()
  await input.trx
    .updateTable('flowRunNodes')
    .set({ status: 'running', updatedAt: new Date() })
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', claimed.flowRunId)
    .where('nodeId', '=', claimed.nodeId)
    .where('status', '=', 'pending')
    .execute()
  await input.trx
    .updateTable('flowRunNodeItems')
    .set({ status: 'running', updatedAt: new Date() })
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', claimed.flowRunId)
    .where('nodeId', '=', claimed.nodeId)
    .where('itemKey', '=', claimed.itemKey)
    .where('status', '=', 'pending')
    .execute()
  return BrowserRunClaimedJobSchema.parse({
    debugOutputs:
      execution.executionMode === 'debug'
        ? await createDebugOutputs({
            mediaType: claimed.mediaType as
            | 'audio'
            | 'image'
            | 'text'
            | 'video',
            outputCount: request.outputCount,
          })
        : null,
    executionContract: toBrowserExecutionContract(execution.contract),
    executionMode: execution.executionMode,
    inputAssets,
    job: {
      flowRunId: claimed.flowRunId,
      id: claimed.id,
      itemKey: claimed.itemKey,
      mediaType: claimed.mediaType,
      providerJobId: claimed.providerJobId,
      providerSubmittedAt: claimed.providerSubmittedAt?.toISOString() ?? null,
      stepId: claimed.nodeId,
      submissionState: claimed.browserSubmissionState,
      status: 'running',
    },
    request,
  })
}

/** Fails unrecoverable submissions only when this fence still owns the outcome. */
async function failUncertainSubmissions(input: {
  activeJobIds: readonly string[]
  fenceToken: number
  organizationId: string
  snapshot: FlowRunSnapshot<ReadableFlowRunPlanSnapshot>
  runId: string
  trx: Transaction<Database>
}) {
  const uncertain = await input.trx
    .selectFrom('generationJobs')
    .select([
      'browserFenceToken',
      'browserSubmissionState',
      'id',
      'nodeId',
      'providerJobId',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.runId)
    .where('status', '=', 'running')
    .where(eb =>
      eb.or([
        eb('browserSubmissionState', '=', 'submitting'),
        eb.and([
          eb('browserSubmissionState', '=', 'submitted'),
          eb('providerJobId', 'is', null),
        ]),
      ]),
    )
    .execute()
  const active = new Set(input.activeJobIds)
  let failedCount = 0
  for (const job of uncertain) {
    if (active.has(job.id) && job.browserFenceToken === input.fenceToken)
      continue
    const failed = await markJobFailed(
      {
        failure: toSafeRunFailure(
          new Error('provider_submission_uncertain'),
          'provider_submission_uncertain',
        ),
        jobId: job.id,
        organizationId: input.organizationId,
      },
      input.trx,
    )
    if (!failed)
      continue
    await input.trx
      .updateTable('generationJobs')
      .set({
        providerSettlementResolvedAt: new Date(),
        providerSettlementStatus: 'unknown',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', job.id)
      .execute()
    await skipDescendants(
      {
        failedNodeIds: [job.nodeId],
        flowRunId: input.runId,
        graphSnapshot: input.snapshot,
        organizationId: input.organizationId,
      },
      input.trx,
    )
    failedCount += 1
  }
  if (failedCount > 0)
    await aggregateFlowRunState(input.organizationId, input.runId, input.trx)
}

async function reconcileBrowserOutputProcessing(input: {
  activeJobIds: readonly string[]
  executionMode: 'debug' | 'live'
  organizationId: string
  snapshot: FlowRunSnapshot<ReadableFlowRunPlanSnapshot>
  runId: string
  trx: Transaction<Database>
}) {
  const jobs = await input.trx
    .selectFrom('generationJobs')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.runId)
    .where('status', '=', 'running')
    .execute()
  const activeJobIds = new Set(input.activeJobIds)
  const processingJobIds: string[] = []
  let failedCount = 0
  for (const job of jobs) {
    if (activeJobIds.has(job.id))
      continue
    const readiness = await readBrowserJobOutputReadiness(job, input.trx)
    if (readiness === 'incomplete')
      continue
    if (readiness === 'processing') {
      processingJobIds.push(job.id)
      continue
    }
    if (readiness === 'ready') {
      await settleReadyBrowserJob({
        executionMode: input.executionMode,
        job,
        trx: input.trx,
      })
      continue
    }
    const failed = await markJobFailed(
      {
        failure: toSafeRunFailure(
          new Error('generation_asset_ingest_failed'),
          'generation_failed',
        ),
        jobId: job.id,
        organizationId: input.organizationId,
      },
      input.trx,
    )
    if (!failed)
      continue
    await skipDescendants(
      {
        failedNodeIds: [job.nodeId],
        flowRunId: input.runId,
        graphSnapshot: input.snapshot,
        organizationId: input.organizationId,
      },
      input.trx,
    )
    failedCount += 1
  }
  if (failedCount > 0)
    await aggregateFlowRunState(input.organizationId, input.runId, input.trx)
  return processingJobIds
}

/** Claims ready jobs only while the lease fence remains locked and current. */
export async function claimBrowserRunJobs(input: {
  activeJobIds: string[]
  executorId: string
  fenceToken: number
  limit: number
  organizationId: string
  runId: string
  userId: string
}) {
  const result = await withBrowserRunLease(input, async (run, trx) => {
    if (!['pending', 'running'].includes(run.status))
      return { jobs: [], reconciledTerminal: true }
    const processingJobIds = await reconcileBrowserOutputProcessing({
      activeJobIds: input.activeJobIds,
      executionMode: readFlowRunExecutionMode(
        run.artifact.snapshot.executionMode,
      ),
      organizationId: input.organizationId,
      snapshot: run.artifact.snapshot,
      runId: input.runId,
      trx,
    })
    const protectedJobIds = [
      ...new Set([...input.activeJobIds, ...processingJobIds]),
    ]
    await failUncertainSubmissions({
      activeJobIds: protectedJobIds,
      fenceToken: input.fenceToken,
      organizationId: input.organizationId,
      snapshot: run.artifact.snapshot,
      runId: input.runId,
      trx,
    })
    const candidates = await selectClaimCandidates({
      activeJobIds: protectedJobIds,
      limit: Math.min(input.limit, BROWSER_RUN_MAX_CLAIM_COUNT),
      organizationId: input.organizationId,
      plan: run.artifact.snapshot.executionPlan,
      runId: input.runId,
      trx,
    })
    if (candidates.length === 0) {
      const activeJob = await trx
        .selectFrom('generationJobs')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('flowRunId', '=', input.runId)
        .where('status', 'in', ['pending', 'running'])
        .executeTakeFirst()
      if (!activeJob) {
        const status = await aggregateFlowRunState(
          input.organizationId,
          input.runId,
          trx,
        )
        return {
          jobs: [],
          reconciledTerminal:
            status !== null && !['pending', 'running'].includes(status),
        }
      }
    }
    const jobs = []
    for (const job of candidates) {
      const claimed = await materializeClaimedJob({
        fenceToken: input.fenceToken,
        job,
        organizationId: input.organizationId,
        snapshot: run.artifact.snapshot,
        trx,
      })
      if (claimed)
        jobs.push(claimed)
    }
    return { jobs, reconciledTerminal: false }
  })
  if (result.reconciledTerminal) {
    // Only naturally finished runs reset the executor surface; cancellation
    // owns these fields until provider settlement is reconciled.
    await db
      .updateTable('flowRuns')
      .set({
        browserExecutorCode: null,
        browserExecutorStatus: 'ready',
        browserExecutorUpdatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.runId)
      .where('executionRuntime', '=', 'browser')
      .where('status', 'in', ['succeeded', 'partial', 'failed'])
      .execute()
    await retireBrowserRunLeaseIfTerminal({
      organizationId: input.organizationId,
      runId: input.runId,
    })
  }
  return { jobs: result.jobs }
}
