/** Tenant-scoped Flow run detail and history response projection. */

import { db } from '@talelabs/db'

import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../../pagination/pagination.js'
import { presentAsset } from '../../services/asset-presenter.js'
import { executionModeFromSnapshot } from './execution-mode.js'
import { extractPlanSummary } from './plan-summary.js'
import { safeFailureFields } from './response-safety.js'

/** Reads one tenant-scoped run with its durable nodes, jobs, and outputs. */
export async function getRunDetail(organizationId: string, runId: string) {
  const run = await db.selectFrom('flowRuns')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', runId)
    .executeTakeFirst()
  if (!run)
    throw new TenantResourceNotFoundError()

  const [nodes, items, jobs, assets, texts] = await Promise.all([
    db.selectFrom('flowRunNodes').selectAll().where('organizationId', '=', organizationId).where('flowRunId', '=', runId).orderBy('createdAt').orderBy('nodeId').execute(),
    db.selectFrom('flowRunNodeItems').selectAll().where('organizationId', '=', organizationId).where('flowRunId', '=', runId).orderBy('sortOrder').execute(),
    db.selectFrom('generationJobs').selectAll().where('organizationId', '=', organizationId).where('flowRunId', '=', runId).orderBy('createdAt').orderBy('id').execute(),
    db.selectFrom('assets').selectAll().where('organizationId', '=', organizationId).where('generationJobId', 'in', eb => eb.selectFrom('generationJobs')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('flowRunId', '=', runId)).orderBy('outputIndex').execute(),
    db.selectFrom('generationJobTextOutputs').selectAll().where('organizationId', '=', organizationId).where('jobId', 'in', eb => eb.selectFrom('generationJobs')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('flowRunId', '=', runId)).orderBy('outputIndex').execute(),
  ])
  const assetsByJob = new Map<string, typeof assets>()
  for (const asset of assets) {
    assetsByJob.set(
      asset.generationJobId!,
      [...(assetsByJob.get(asset.generationJobId!) ?? []), asset],
    )
  }
  const textsByJob = new Map<string, typeof texts>()
  for (const text of texts)
    textsByJob.set(text.jobId, [...(textsByJob.get(text.jobId) ?? []), text])
  const presentedAssets = new Map<string, Awaited<ReturnType<typeof presentAsset>>[]>()
  for (const [jobId, jobAssets] of assetsByJob) {
    presentedAssets.set(
      jobId,
      await Promise.all(jobAssets.map(asset => presentAsset(asset))),
    )
  }
  const itemsByNode = new Map<string, typeof items>()
  for (const item of items)
    itemsByNode.set(item.nodeId, [...(itemsByNode.get(item.nodeId) ?? []), item])
  const jobsByNode = new Map<string, typeof jobs>()
  for (const job of jobs)
    jobsByNode.set(job.nodeId, [...(jobsByNode.get(job.nodeId) ?? []), job])

  return {
    id: run.id,
    executionMode: executionModeFromSnapshot(run.graphSnapshot),
    flowId: run.flowId,
    mode: run.mode as 'all' | 'downstream' | 'node' | 'selection' | 'upstream',
    targetNodeId: run.targetNodeId,
    status: run.status,
    planHash: ((run.graphSnapshot as any)?.plan?.planHash ?? '') as string,
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
          visibility: asset.visibility,
          jobId: job.id,
          mimeType: asset.mimeType,
          outputIndex: asset.outputIndex ?? 0,
          thumbnailUrl: asset.thumbnailUrl,
          type: asset.type,
          url: asset.url ?? asset.thumbnailUrl,
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

/** Lists tenant-scoped run summaries using stable cursor pagination. */
export async function listRuns(input: {
  cursor?: string
  flowId?: string
  limit: number
  organizationId: string
  status?: 'canceled' | 'failed' | 'partial' | 'pending' | 'running' | 'succeeded'
}) {
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
  let query = db.selectFrom('flowRuns')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
  if (input.flowId)
    query = query.where('flowId', '=', input.flowId)
  if (input.status)
    query = query.where('status', '=', input.status)
  if (pagination.value.cursor) {
    const cursor = pagination.value.cursor
    const cursorCreatedAt = new Date(String(cursor.sortValue))
    query = query.where(eb => eb.or([
      eb('createdAt', '<', cursorCreatedAt),
      eb.and([eb('createdAt', '=', cursorCreatedAt), eb('id', '<', cursor.id)]),
    ]))
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
  const nodeCounts = runIds.length > 0
    ? await db.selectFrom('flowRunNodes')
        .select(['flowRunId', 'status'])
        .select(eb => eb.fn.countAll<number>().as('count'))
        .where('organizationId', '=', input.organizationId)
        .where('flowRunId', 'in', runIds)
        .groupBy(['flowRunId', 'status'])
        .execute()
    : []
  const nodeCountsByRun = new Map<string, Record<string, number>>()
  for (const count of nodeCounts) {
    nodeCountsByRun.set(count.flowRunId, {
      ...(nodeCountsByRun.get(count.flowRunId) ?? {}),
      [count.status]: Number(count.count),
    })
  }
  return {
    data: page.pageRows.map(run => ({
      id: run.id,
      executionMode: executionModeFromSnapshot(run.graphSnapshot),
      flowId: run.flowId,
      mode: run.mode as 'all' | 'downstream' | 'node' | 'selection' | 'upstream',
      targetNodeId: run.targetNodeId,
      status: run.status,
      planHash: ((run.graphSnapshot as any)?.plan?.planHash ?? '') as string,
      snapshotHash: run.snapshotHash,
      ...safeFailureFields(run.errorCode, run.errorMessage),
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      summary: extractPlanSummary(run),
      nodeCounts: nodeCountsByRun.get(run.id) ?? {},
    })),
    nextCursor: page.nextCursor,
  }
}
