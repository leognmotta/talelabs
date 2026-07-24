/** Tenant-scoped durable run detail and bounded history response projection. */

import { db } from '@talelabs/db'
import { sql } from 'kysely'

import {
  HttpError,
  TenantResourceNotFoundError,
} from '../../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../../pagination/pagination.js'
import { presentAsset } from '../../services/asset-presenter.js'
import { executionModeFromSnapshot } from './execution-mode.js'
import { extractPlanSummary } from './plan-summary.js'
import { requestSummaryFromJob } from './request-summary.js'
import { safeFailureFields } from './response-safety.js'

const RUN_HISTORY_OUTPUT_LIMIT = 16

const runHistoryProjection = [
  'browserExecutorCode',
  'browserExecutorStatus',
  'browserExecutorUpdatedAt',
  'completedAt',
  'createSessionId',
  'createdAt',
  'errorCode',
  'errorMessage',
  'executionRuntime',
  'flowId',
  'id',
  'mode',
  'source',
  'snapshotHash',
  'startedAt',
  'status',
  'targetNodeId',
] as const

function browserExecutionFromRun(run: {
  browserExecutorCode: string | null
  browserExecutorStatus:
    | 'blocked'
    | 'canceling'
    | 'error'
    | 'ready'
    | 'retrying'
    | null
  browserExecutorUpdatedAt: Date | null
  executionRuntime: 'browser' | 'managed'
}) {
  if (run.executionRuntime !== 'browser' || !run.browserExecutorStatus)
    return null
  return {
    code: run.browserExecutorCode,
    status: run.browserExecutorStatus,
    updatedAt: run.browserExecutorUpdatedAt?.toISOString() ?? null,
  }
}

/**
 * Reads one tenant-scoped run with its durable nodes, jobs, and outputs.
 *
 * Flow runs are workspace-collaborative. Direct Create runs remain private to
 * their authenticated creator, matching their session and history boundary.
 */
export async function getRunDetail(
  organizationId: string,
  runId: string,
  userId: string,
) {
  const run = await db
    .selectFrom('flowRuns')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', runId)
    .executeTakeFirst()
  if (!run || (run.source === 'create' && run.createdBy !== userId))
    throw new TenantResourceNotFoundError()

  const [nodes, items, jobs, assets, texts] = await Promise.all([
    db
      .selectFrom('flowRunNodes')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('flowRunId', '=', runId)
      .orderBy('createdAt')
      .orderBy('nodeId')
      .execute(),
    db
      .selectFrom('flowRunNodeItems')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('flowRunId', '=', runId)
      .orderBy('sortOrder')
      .execute(),
    db
      .selectFrom('generationJobs')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('flowRunId', '=', runId)
      .orderBy('createdAt')
      .orderBy('id')
      .execute(),
    db
      .selectFrom('assets')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('generationJobId', 'in', eb =>
        eb
          .selectFrom('generationJobs')
          .select('id')
          .where('organizationId', '=', organizationId)
          .where('flowRunId', '=', runId))
      .orderBy('outputIndex')
      .execute(),
    db
      .selectFrom('generationJobTextOutputs')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('jobId', 'in', eb =>
        eb
          .selectFrom('generationJobs')
          .select('id')
          .where('organizationId', '=', organizationId)
          .where('flowRunId', '=', runId))
      .orderBy('outputIndex')
      .execute(),
  ])
  const assetsByJob = new Map<string, typeof assets>()
  for (const asset of assets) {
    assetsByJob.set(asset.generationJobId!, [
      ...(assetsByJob.get(asset.generationJobId!) ?? []),
      asset,
    ])
  }
  const textsByJob = new Map<string, typeof texts>()
  for (const text of texts)
    textsByJob.set(text.jobId, [...(textsByJob.get(text.jobId) ?? []), text])
  const presentedAssets = new Map<
    string,
    Awaited<ReturnType<typeof presentAsset>>[]
  >()
  for (const [jobId, jobAssets] of assetsByJob) {
    presentedAssets.set(
      jobId,
      await Promise.all(jobAssets.map(asset => presentAsset(asset))),
    )
  }
  const itemsByNode = new Map<string, typeof items>()
  for (const item of items) {
    itemsByNode.set(item.nodeId, [
      ...(itemsByNode.get(item.nodeId) ?? []),
      item,
    ])
  }
  const jobsByNode = new Map<string, typeof jobs>()
  for (const job of jobs)
    jobsByNode.set(job.nodeId, [...(jobsByNode.get(job.nodeId) ?? []), job])

  return {
    id: run.id,
    browserExecution: browserExecutionFromRun(run),
    executionMode: executionModeFromSnapshot(run.graphSnapshot),
    executionRuntime: run.executionRuntime,
    createSessionId: run.createSessionId,
    flowId: run.flowId,
    mode: run.mode as
    | 'all'
    | 'direct'
    | 'downstream'
    | 'node'
    | 'selection'
    | 'upstream',
    source: run.source,
    targetNodeId: run.targetNodeId,
    status: run.status,
    planHash: ((run.graphSnapshot as any)?.source?.flowPlanHash
      ?? (run.graphSnapshot as any)?.executionPlan?.executionPlanHash
      ?? (run.graphSnapshot as any)?.plan?.planHash
      ?? '') as string,
    snapshotHash: run.snapshotHash,
    ...safeFailureFields(run.errorCode, run.errorMessage),
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    summary: extractPlanSummary(run),
    nodes: nodes.map(node => ({
      nodeId: node.nodeId,
      status: node.status,
      items: (itemsByNode.get(node.nodeId) ?? []).map(item => ({
        nodeId: item.nodeId,
        itemKey: item.itemKey,
        sortOrder: item.sortOrder,
        status: item.status,
        dimensions: item.dimensions as Record<string, unknown>,
        lineage: item.lineage as unknown[],
      })),
      jobs: (jobsByNode.get(node.nodeId) ?? []).map(job => ({
        id: job.id,
        nodeId: job.nodeId,
        itemKey: job.itemKey,
        requestIndex: Number(job.requestIndex),
        mediaType: job.mediaType,
        status: job.status,
        model: job.model,
        operation: job.operation,
        ...safeFailureFields(job.errorCode, job.errorMessage),
        assetOutputs: (presentedAssets.get(job.id) ?? []).map(asset => ({
          assetId: asset.id,
          durationSeconds: asset.durationSeconds,
          height: asset.height,
          visibility: asset.visibility,
          jobId: job.id,
          mimeType: asset.mimeType,
          outputIndex: asset.outputIndex ?? 0,
          thumbnailUrl: asset.thumbnailUrl,
          type: asset.type,
          url: asset.url ?? asset.thumbnailUrl,
          width: asset.width,
        })),
        textOutputs: (textsByJob.get(job.id) ?? []).map(text => ({
          jobId: job.id,
          outputIndex: text.outputIndex,
          text: text.text,
        })),
      })),
    })),
  }
}

/** Lists active run identities without reading snapshots, jobs, or Assets. */
export async function listActiveRuns(input: {
  executionRuntime: 'browser' | 'managed'
  organizationId: string
  requestingUserId: string
  scope: 'all' | 'mine'
  source?: 'create' | 'flow'
}) {
  let query = db
    .selectFrom('flowRuns')
    .select([
      'createSessionId',
      'executionRuntime',
      'flowId',
      'id',
      'source',
      'status',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('executionRuntime', '=', input.executionRuntime)
  if (input.scope === 'mine') {
    query = query.where('createdBy', '=', input.requestingUserId)
  }
  else if (input.source === 'create') {
    query = query.where('createdBy', '=', input.requestingUserId)
  }
  else if (!input.source) {
    query = query.where(eb => eb.or([
      eb('source', '=', 'flow'),
      eb.and([
        eb('source', '=', 'create'),
        eb('createdBy', '=', input.requestingUserId),
      ]),
    ]))
  }
  if (input.source) {
    query = query.where('source', '=', input.source)
  }
  query = input.executionRuntime === 'browser'
    ? query.where(eb => eb.or([
        eb('status', 'in', ['pending', 'running']),
        eb.and([
          eb('status', '=', 'canceled'),
          eb('cancellationReconciledAt', 'is', null),
        ]),
      ]))
    : query.where('status', 'in', ['pending', 'running'])
  return {
    data: await query
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(200)
      .execute(),
  }
}

/** Lists bounded Flow or creator-scoped direct history using stable pagination. */
export async function listRunHistory(input: {
  createSessionId?: string
  createdBy: string
  cursor?: string
  flowId?: string
  limit: number
  organizationId: string
  source: 'create' | 'flow'
}) {
  if (input.source === 'flow' && !input.flowId) {
    throw new HttpError(
      400,
      'validation_error',
      'The run list query is invalid.',
    )
  }
  if (input.source === 'create' && !input.createSessionId) {
    throw new HttpError(
      400,
      'validation_error',
      'A Create session is required for direct run history.',
    )
  }
  const pagination = resolvePagination(
    { cursor: input.cursor, limit: input.limit },
    {
      cursorValueParsers: { createdAt: parseIsoTimestampCursorValue },
      defaultOrder: 'desc',
      defaultSort: 'createdAt',
    },
  )
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The run list query is invalid.',
      pagination.details,
    )
  }
  let query = db
    .selectFrom('flowRuns')
    .select(runHistoryProjection)
    .select(sql<string | null>`
      ${sql.ref('graphSnapshot')} #>> '{executionMode}'
    `.as('executionMode'))
    .select(sql<string | null>`
      coalesce(
        ${sql.ref('graphSnapshot')} #>> '{source,flowPlanHash}',
        ${sql.ref('graphSnapshot')} #>> '{executionPlan,executionPlanHash}',
        ${sql.ref('graphSnapshot')} #>> '{plan,planHash}'
      )
    `.as('planHash'))
    .select(sql<string | null>`
      coalesce(
        ${sql.ref('graphSnapshot')} #>> '{executionPlan,steps,0,stepId}',
        ${sql.ref('graphSnapshot')} #>> '{plan,executionNodes,0,nodeId}'
      )
    `.as('requestNodeId'))
    .select(sql<string | null>`
      coalesce(
        ${sql.ref('graphSnapshot')} #>> '{executionPlan,steps,0,stepType}',
        ${sql.ref('graphSnapshot')} #>> '{plan,executionNodes,0,nodeType}'
      )
    `.as('requestNodeType'))
    .select(sql<string | null>`
      coalesce(
        ${sql.ref('graphSnapshot')} #>> '{executionPlan,summary,expectedOutputCount}',
        ${sql.ref('graphSnapshot')} #>> '{plan,summary,expectedOutputCount}'
      )
    `.as('expectedOutputCount'))
    .select(sql<string | null>`
      coalesce(
        ${sql.ref('graphSnapshot')} #>> '{executionPlan,summary,plannedExecutableCount}',
        ${sql.ref('graphSnapshot')} #>> '{plan,summary,plannedExecutableCount}'
      )
    `.as('plannedExecutableCount'))
    .select(sql<string | null>`
      coalesce(
        ${sql.ref('graphSnapshot')} #>> '{executionPlan,summary,plannedItemCount}',
        ${sql.ref('graphSnapshot')} #>> '{plan,summary,plannedItemCount}'
      )
    `.as('plannedItemCount'))
    .select(sql<string | null>`
      coalesce(
        ${sql.ref('graphSnapshot')} #>> '{executionPlan,summary,plannedJobCount}',
        ${sql.ref('graphSnapshot')} #>> '{plan,summary,plannedJobCount}'
      )
    `.as('plannedJobCount'))
    .where('organizationId', '=', input.organizationId)
    .where('source', '=', input.source)
  query = input.source === 'create'
    ? query
        .where('createdBy', '=', input.createdBy)
        .where('createSessionId', '=', input.createSessionId!)
        .where('flowId', 'is', null)
    : query.where('flowId', '=', input.flowId!)
  if (pagination.value.cursor) {
    const cursor = pagination.value.cursor
    const cursorCreatedAt = new Date(String(cursor.sortValue))
    query = query.where(eb =>
      eb.or([
        eb('createdAt', '<', cursorCreatedAt),
        eb.and([
          eb('createdAt', '=', cursorCreatedAt),
          eb('id', '<', cursor.id),
        ]),
      ]),
    )
  }
  const rows = await query
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(pagination.value.limit + 1)
    .execute()
  const page = buildCursorPage({
    cursorFromRow: run => ({
      id: run.id,
      order: 'desc' as const,
      sort: 'createdAt' as const,
      sortValue: run.createdAt.toISOString(),
    }),
    limit: pagination.value.limit,
    rows,
    serialize: run => run,
  })
  const runIds = page.pageRows.map(run => run.id)
  const requestNodeScopes = page.pageRows.flatMap(run => (
    run.requestNodeId && run.requestNodeType
      ? [{
          nodeId: run.requestNodeId,
          nodeType: run.requestNodeType,
          runId: run.id,
        }]
      : []
  ))
  const rankedOutputAssets = db
    .selectFrom('assets as asset')
    .innerJoin(
      'generationJobs as job',
      'job.id',
      'asset.generationJobId',
    )
    .selectAll('asset')
    .select('job.flowRunId as flowRunId')
    .select(sql<number>`
      count(*) over (
        partition by ${sql.ref('job.flowRunId')}
      )
    `.as('runOutputCount'))
    .select(sql<number>`
      row_number() over (
        partition by ${sql.ref('job.flowRunId')}
        order by
          ${sql.ref('job.nodeId')},
          ${sql.ref('job.itemKey')},
          ${sql.ref('job.requestIndex')},
          ${sql.ref('job.id')},
          ${sql.ref('asset.outputIndex')},
          ${sql.ref('asset.id')}
      )
    `.as('runOutputRank'))
    .where('asset.organizationId', '=', input.organizationId)
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', 'in', runIds)
  const [nodeCounts, outputAssets, representativeJobs] = runIds.length > 0
    ? await Promise.all([
        db
          .selectFrom('flowRunNodes')
          .select(['flowRunId', 'status'])
          .select(eb => eb.fn.countAll<number>().as('count'))
          .where('organizationId', '=', input.organizationId)
          .where('flowRunId', 'in', runIds)
          .groupBy(['flowRunId', 'status'])
          .execute(),
        db
          .selectFrom(rankedOutputAssets.as('rankedOutput'))
          .selectAll()
          .where('runOutputRank', '<=', RUN_HISTORY_OUTPUT_LIMIT)
          .orderBy('flowRunId')
          .orderBy('runOutputRank')
          .execute(),
        requestNodeScopes.length > 0
          ? db
              .selectFrom('generationJobs')
              .distinctOn('flowRunId')
              .select([
                'flowRunId',
                'mediaType',
                'nodeId',
                'requestHash',
                'requestPayload',
              ])
              .where('organizationId', '=', input.organizationId)
              .where(eb => eb.or(requestNodeScopes.map(scope => eb.and([
                eb('flowRunId', '=', scope.runId),
                eb('nodeId', '=', scope.nodeId),
              ]))))
              .orderBy('flowRunId')
              .orderBy('requestIndex')
              .orderBy('itemKey')
              .orderBy('id')
              .execute()
          : Promise.resolve([]),
      ])
    : [[], [], []]
  const nodeCountsByRun = new Map<string, Record<string, number>>()
  for (const count of nodeCounts) {
    nodeCountsByRun.set(count.flowRunId, {
      ...(nodeCountsByRun.get(count.flowRunId) ?? {}),
      [count.status]: Number(count.count),
    })
  }
  const outputsByRun = new Map<string, {
    assetId: string
    durationSeconds: null | number
    height: null | number
    visibility: 'private' | 'public'
    jobId: string
    mimeType: string
    outputIndex: number
    thumbnailUrl: null | string
    type: 'audio' | 'document' | 'image' | 'video'
    url: null
    width: null | number
  }[]>()
  const truncatedOutputsByRun = new Set<string>()
  const presentedOutputs = await Promise.all(outputAssets.map(async asset => ({
    asset,
    presented: await presentAsset(asset, undefined, {
      includeOriginalUrl: false,
    }),
  })))
  for (const { asset, presented } of presentedOutputs) {
    if (Number(asset.runOutputCount) > RUN_HISTORY_OUTPUT_LIMIT)
      truncatedOutputsByRun.add(asset.flowRunId)
    outputsByRun.set(asset.flowRunId, [
      ...(outputsByRun.get(asset.flowRunId) ?? []),
      {
        assetId: presented.id,
        durationSeconds: presented.durationSeconds,
        height: presented.height,
        visibility: presented.visibility,
        jobId: asset.generationJobId!,
        mimeType: presented.mimeType,
        outputIndex: presented.outputIndex ?? 0,
        thumbnailUrl: presented.thumbnailUrl,
        type: presented.type,
        url: null,
        width: presented.width,
      },
    ])
  }
  const requestNodeTypesByRun = new Map(
    requestNodeScopes.map(scope => [scope.runId, scope.nodeType]),
  )
  const requestSummariesByRun = new Map(
    representativeJobs.map(job => [
      job.flowRunId,
      requestSummaryFromJob({
        mediaType: job.mediaType,
        nodeType: requestNodeTypesByRun.get(job.flowRunId) ?? '',
        requestHash: job.requestHash,
        requestPayload: job.requestPayload,
      }),
    ]),
  )
  return {
    data: page.pageRows.map(run => ({
      id: run.id,
      browserExecution: browserExecutionFromRun(run),
      executionMode: run.executionMode === 'debug' ? 'debug' as const : 'live' as const,
      executionRuntime: run.executionRuntime,
      createSessionId: run.createSessionId,
      flowId: run.flowId,
      mode: run.mode as
      | 'all'
      | 'direct'
      | 'downstream'
      | 'node'
      | 'selection'
      | 'upstream',
      source: run.source,
      targetNodeId: run.targetNodeId,
      status: run.status,
      planHash: run.planHash ?? '',
      snapshotHash: run.snapshotHash,
      ...safeFailureFields(run.errorCode, run.errorMessage),
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      summary: {
        expectedOutputCount: Number(run.expectedOutputCount ?? 0),
        plannedExecutableCount: Number(run.plannedExecutableCount ?? 0),
        plannedItemCount: Number(run.plannedItemCount ?? 0),
        plannedJobCount: Number(run.plannedJobCount ?? 0),
      },
      assetOutputs: outputsByRun.get(run.id) ?? [],
      assetOutputsTruncated: truncatedOutputsByRun.has(run.id),
      nodeCounts: nodeCountsByRun.get(run.id) ?? {},
      requestSummary: requestSummariesByRun.get(run.id) ?? null,
    })),
    nextCursor: page.nextCursor,
  }
}
