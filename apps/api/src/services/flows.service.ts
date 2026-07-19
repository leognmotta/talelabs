/**
 * Flow CRUD, graph read/sync, and latest-result presentation. Graph-reference
 * hydration and validation-context construction live in
 * `flow-graph-reference.service.ts`.
 */

import type {
  AssetType,
  AssetVisibility,
  JsonValue,
} from '@talelabs/db'
import type {
  FlowGraphEdge,
  FlowGraphNode,
} from '@talelabs/flows'

import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'
import {
  compareFlowEdgesByPriority,
  FLOW_GRAPH_LIMITS,
  validateFlowGraphDraft,
} from '@talelabs/flows'

import {
  deleteFlowRow,
  findFlowById,
  getFlowGraphRows,
  insertFlowRow,
  listFlowRows,
  syncFlowGraphRows,
  updateFlowRow,
} from '../data/flows.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../pagination/pagination.js'
import { presentAsset } from './asset-presenter.js'
import {
  flowGraphValidationError,
  getValidationContext,
  presentEdge,
  presentNode,
} from './flow-graph-reference.service.js'

interface FlowLatestResultAssetOutput {
  assetId: string
  visibility: AssetVisibility
  mimeType: string
  outputIndex: number
  thumbnailUrl: null | string
  type: AssetType
  url: null | string
}

interface FlowLatestResultTextOutput {
  outputIndex: number
  text: string
}

interface FlowLatestResultJob {
  assetOutputs: FlowLatestResultAssetOutput[]
  itemKey: string
  jobId: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  textOutputs: FlowLatestResultTextOutput[]
}

interface FlowLatestResult {
  jobs: FlowLatestResultJob[]
  nodeId: string
  runCreatedAt: string
  runId: string
}

function presentViewport(value: JsonValue) {
  if (!value || Array.isArray(value) || typeof value !== 'object')
    return { x: 0, y: 0, zoom: 1 }

  const x = typeof value.x === 'number' ? value.x : 0
  const y = typeof value.y === 'number' ? value.y : 0
  const zoom = typeof value.zoom === 'number' ? value.zoom : 1
  return { x, y, zoom }
}

function presentFlow(flow: NonNullable<Awaited<ReturnType<typeof findFlowById>>>) {
  return {
    id: flow.id,
    name: flow.name,
    revision: Number(flow.revision),
    viewport: presentViewport(flow.viewport),
    createdBy: flow.createdBy,
    createdAt: flow.createdAt.toISOString(),
    updatedAt: flow.updatedAt.toISOString(),
  }
}

async function listFlowLatestResults(input: {
  flowId: string
  nodeIds: readonly string[]
  organizationId: string
}): Promise<FlowLatestResult[]> {
  if (input.nodeIds.length === 0)
    return []

  const latestRunNodes = await db.selectFrom('flowRunNodes as node')
    .innerJoin('flowRuns as run', join => join
      .onRef('run.id', '=', 'node.flowRunId')
      .onRef('run.organizationId', '=', 'node.organizationId'))
    .select([
      'node.nodeId',
      'run.createdAt as runCreatedAt',
      'run.id as runId',
    ])
    .where('run.organizationId', '=', input.organizationId)
    .where('run.flowId', '=', input.flowId)
    .where('node.nodeId', 'in', [...input.nodeIds])
    .where('node.status', 'in', ['succeeded', 'partial'])
    .where('run.status', 'in', ['succeeded', 'partial'])
    .distinctOn('node.nodeId')
    .orderBy('node.nodeId')
    .orderBy('run.createdAt', 'desc')
    .orderBy('run.id', 'desc')
    .execute()

  if (latestRunNodes.length === 0)
    return []

  const nodeRunKeys = new Set(
    latestRunNodes.map(row => `${row.nodeId}\u0000${row.runId}`),
  )
  const runIds = [...new Set(latestRunNodes.map(row => row.runId))]
  const jobs = (await db.selectFrom('generationJobs')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('flowId', '=', input.flowId)
    .where('flowRunId', 'in', runIds)
    .where('status', '=', 'succeeded')
    .orderBy('nodeId')
    .orderBy('itemKey')
    .orderBy('requestIndex')
    .orderBy('id')
    .execute())
    .filter(job => nodeRunKeys.has(`${job.nodeId}\u0000${job.flowRunId}`))

  if (jobs.length === 0) {
    return latestRunNodes.map(row => ({
      jobs: [],
      nodeId: row.nodeId,
      runCreatedAt: row.runCreatedAt.toISOString(),
      runId: row.runId,
    }))
  }

  const jobIds = jobs.map(job => job.id)
  const [textOutputs, assetOutputs] = await Promise.all([
    db.selectFrom('generationJobTextOutputs')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('jobId', 'in', jobIds)
      .orderBy('jobId')
      .orderBy('outputIndex')
      .execute(),
    db.selectFrom('assets')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('generationJobId', 'in', jobIds)
      .where('processingState', '=', 'ready')
      .where('deletedAt', 'is', null)
      .where('purgeRequestedAt', 'is', null)
      .where('purgedAt', 'is', null)
      .orderBy('generationJobId')
      .orderBy('outputIndex')
      .execute(),
  ])

  const textsByJob = new Map<string, typeof textOutputs>()
  for (const output of textOutputs)
    textsByJob.set(output.jobId, [...(textsByJob.get(output.jobId) ?? []), output])

  const presentedAssets = await Promise.all(assetOutputs.map(asset =>
    presentAsset(asset)))
  const assetsByJob = new Map<string, typeof presentedAssets>()
  for (const [index, asset] of presentedAssets.entries()) {
    const source = assetOutputs[index]!
    const jobId = source.generationJobId!
    assetsByJob.set(jobId, [...(assetsByJob.get(jobId) ?? []), asset])
  }

  const jobsByNodeRun = new Map<string, FlowLatestResultJob[]>()
  for (const job of jobs) {
    const key = `${job.nodeId}\u0000${job.flowRunId}`
    jobsByNodeRun.set(key, [
      ...(jobsByNodeRun.get(key) ?? []),
      {
        assetOutputs: (assetsByJob.get(job.id) ?? []).map(asset => ({
          assetId: asset.id,
          visibility: asset.visibility,
          mimeType: asset.mimeType,
          outputIndex: asset.outputIndex ?? 0,
          thumbnailUrl: asset.thumbnailUrl,
          type: asset.type,
          url: asset.url ?? asset.thumbnailUrl,
        })),
        itemKey: job.itemKey,
        jobId: job.id,
        mediaType: job.mediaType,
        textOutputs: (textsByJob.get(job.id) ?? []).map(output => ({
          outputIndex: output.outputIndex,
          text: output.text,
        })),
      },
    ])
  }

  return latestRunNodes.map(row => ({
    jobs: jobsByNodeRun.get(`${row.nodeId}\u0000${row.runId}`) ?? [],
    nodeId: row.nodeId,
    runCreatedAt: row.runCreatedAt.toISOString(),
    runId: row.runId,
  }))
}

/** Lists Flows for one organization as a cursor page. */
export async function listFlows(input: {
  cursor?: string
  limit: number
  organizationId: string
  search?: string
}) {
  const pagination = resolvePagination({
    cursor: input.cursor,
    limit: input.limit,
  }, {
    cursorValueParsers: { updatedAt: parseIsoTimestampCursorValue },
    defaultOrder: 'desc',
    defaultSort: 'updatedAt',
  })
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The pagination options are invalid.',
      pagination.details,
    )
  }

  const rows = await listFlowRows({
    ...input,
    cursor: pagination.value.cursor,
    limit: pagination.value.limit,
  })
  const page = buildCursorPage({
    rows,
    limit: pagination.value.limit,
    cursorFromRow: row => ({
      id: row.id,
      order: 'desc',
      sort: 'updatedAt' as const,
      sortValue: row.updatedAt.toISOString(),
    }),
    serialize: row => row,
  })
  return {
    data: page.data.map(presentFlow),
    nextCursor: page.nextCursor,
  }
}

/** Creates an empty Flow at revision 0. */
export async function createFlow(input: {
  createdBy: string
  name: string
  organizationId: string
}) {
  return presentFlow(await insertFlowRow({ ...input, id: createId() }))
}

/** Loads one Flow summary, or throws when absent. */
export async function getFlow(organizationId: string, id: string) {
  const flow = await findFlowById(organizationId, id)
  if (!flow)
    throw new TenantResourceNotFoundError()
  return presentFlow(flow)
}

/** Updates Flow name and/or viewport. */
export async function updateFlow(input: {
  id: string
  name?: string
  organizationId: string
  viewport?: { x: number, y: number, zoom: number }
}) {
  const flow = await updateFlowRow(input)
  if (!flow)
    throw new TenantResourceNotFoundError()
  return presentFlow(flow)
}

/** Deletes one Flow and its graph. */
export async function deleteFlow(organizationId: string, id: string) {
  if (!await deleteFlowRow(organizationId, id))
    throw new TenantResourceNotFoundError()
}

/** Loads the full wire graph: nodes, edges, active runs, latest results. */
export async function getFlowGraph(organizationId: string, flowId: string) {
  const graph = await getFlowGraphRows(
    db,
    organizationId,
    flowId,
  )
  if (!graph)
    throw new TenantResourceNotFoundError()
  const nodes = graph.nodes.map(presentNode)
  const latestResults = await listFlowLatestResults({
    flowId,
    nodeIds: nodes.map(node => node.id),
    organizationId,
  })

  return {
    revision: Number(graph.flow.revision),
    nodes,
    edges: graph.edges.map(presentEdge).toSorted(compareFlowEdgesByPriority),
    activeRuns: graph.activeRuns.map(run => ({
      runId: run.runId,
      nodeId: run.nodeId,
      nodeStatus: run.nodeStatus,
      jobStatus: run.jobStatus,
    })),
    latestResults,
  }
}

/** Applies a revision-checked graph delta and returns the new graph. */
export async function syncFlowGraph(input: {
  baseRevision: number
  deleteEdgeIds?: string[]
  deleteNodeIds?: string[]
  flowId: string
  organizationId: string
  upsertEdges?: FlowGraphEdge[]
  upsertNodes?: FlowGraphNode[]
}) {
  const upsertNodes = input.upsertNodes ?? []
  const upsertEdges = input.upsertEdges ?? []
  const deleteNodeIds = input.deleteNodeIds ?? []
  const deleteEdgeIds = input.deleteEdgeIds ?? []
  const mutationCount = upsertNodes.length + upsertEdges.length
    + deleteNodeIds.length + deleteEdgeIds.length
  if (mutationCount > FLOW_GRAPH_LIMITS.mutationsPerRequest) {
    throw flowGraphValidationError([{
      code: 'mutation_limit',
      field: '',
      params: { maximum: FLOW_GRAPH_LIMITS.mutationsPerRequest },
    }])
  }

  const result = await syncFlowGraphRows({
    baseRevision: input.baseRevision,
    deleteEdgeIds,
    deleteNodeIds,
    flowId: input.flowId,
    organizationId: input.organizationId,
    upsertEdges,
    upsertNodes: upsertNodes.map(node => ({
      ...node,
      data: node.data as JsonValue,
    })),
    prepare: async ({ edges, executor, nodes }) => {
      const finalNodes = new Map<string, FlowGraphNode>(
        nodes.map(node => [node.id, presentNode(node)]),
      )
      for (const nodeId of deleteNodeIds)
        finalNodes.delete(nodeId)
      for (const node of upsertNodes)
        finalNodes.set(node.id, node)

      const finalEdges = new Map<string, FlowGraphEdge>()
      for (const edge of edges) {
        if (
          !deleteEdgeIds.includes(edge.id)
          && finalNodes.has(edge.sourceNodeId)
          && finalNodes.has(edge.targetNodeId)
        ) {
          finalEdges.set(edge.id, presentEdge(edge))
        }
      }
      const existingEdgesById = new Map(edges.map(edge => [edge.id, edge]))
      for (const edge of upsertEdges) {
        const existing = existingEdgesById.get(edge.id)
        finalEdges.set(edge.id, {
          ...edge,
          createdAt: existing?.createdAt.toISOString() ?? edge.createdAt,
        })
      }

      const nodeValues = [...finalNodes.values()]
      const edgeValues = [...finalEdges.values()].toSorted(compareFlowEdgesByPriority)
      const context = await getValidationContext({
        executor,
        nodes: nodeValues,
        organizationId: input.organizationId,
      })
      const validation = validateFlowGraphDraft({
        context,
        edges: edgeValues,
        nodes: nodeValues,
      })
      if (!validation.valid)
        throw flowGraphValidationError(validation.issues)

      return {
        edges: edgeValues,
        nodes: validation.nodes.map(node => ({
          ...node,
          data: node.data as JsonValue,
        })),
      }
    },
  })

  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError()
  if (result.status === 'revision_conflict') {
    throw new HttpError(
      409,
      'revision_conflict',
      'The Flow changed before this graph could be saved.',
    )
  }
  if (result.status === 'id_conflict') {
    throw new HttpError(
      409,
      'conflict',
      'A graph identifier is already in use.',
    )
  }

  return { revision: result.revision }
}
