import type { AssetSource, AssetType, JsonValue } from '@talelabs/db'
import type {
  FlowAssetType,
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowNodeType,
} from '@talelabs/flows'

import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'
import {
  compareFlowEdgesByPriority,
  FLOW_GRAPH_LIMITS,
  isFlowNodeType,
  parseAndUpcastFlowNodeData,
  validateFlowGraphDraft,
} from '@talelabs/flows'

import {
  deleteFlowRow,
  findFlowById,
  getFlowGraphRows,
  insertFlowRow,
  listFlowGraphHydrationRows,
  listFlowGraphReferenceRows,
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
import { presentAsset, toWireJsonObject } from './asset-presenter.js'

interface FlowReferenceAssetResponse {
  createdAt: string
  durationSeconds: null | number
  generationModel: null | string
  height: null | number
  id: string
  lifecycle: 'archived' | 'live' | 'purged' | 'purging'
  mimeType: string
  name: string
  processingError: null | string
  processingState: 'failed' | 'processing' | 'ready'
  sizeBytes: null | number
  source: AssetSource
  thumbnailUrl: null | string
  type: AssetType
  url: null | string
  width: null | number
}

interface FlowReferencesResponse {
  assets: FlowReferenceAssetResponse[]
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

function presentNode(node: {
  assetId: null | string
  data: JsonValue
  id: string
  positionX: number
  positionY: number
  schemaVersion: number
  type: string
}): {
  assetId: null | string
  data: Record<string, any>
  id: string
  positionX: number
  positionY: number
  schemaVersion: number
  type: FlowNodeType
} {
  if (!isFlowNodeType(node.type))
    throw new Error(`Stored Flow node type is not registered: ${node.type}`)
  const parsed = parseAndUpcastFlowNodeData(node)

  return {
    id: node.id,
    type: parsed.type,
    positionX: node.positionX,
    positionY: node.positionY,
    assetId: node.assetId,
    data: toWireJsonObject(parsed.data),
    schemaVersion: parsed.schemaVersion,
  }
}

function presentEdge(edge: {
  createdAt: Date | string
  id: string
  sourceHandle: null | string
  sourceNodeId: string
  targetHandle: null | string
  targetNodeId: string
}) {
  return {
    createdAt: edge.createdAt instanceof Date
      ? edge.createdAt.toISOString()
      : edge.createdAt,
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }
}

async function getValidationContext(input: {
  executor: Parameters<typeof listFlowGraphReferenceRows>[0]
  nodes: FlowGraphNode[]
  organizationId: string
}): Promise<FlowGraphValidationContext> {
  const assetIds = [...new Set(input.nodes.flatMap(node => node.assetId ? [node.assetId] : []))]
  const rows = await listFlowGraphReferenceRows(input.executor, {
    assetIds,
    organizationId: input.organizationId,
  })
  const assetsById = new Map(rows.assets.map(asset => [asset.id, asset]))

  for (const node of input.nodes) {
    if (node.assetId && !assetsById.has(node.assetId))
      throw new TenantResourceNotFoundError(`nodes.${node.id}.assetId`)
  }

  return {
    assetTypesById: Object.fromEntries(
      rows.assets.map(asset => [asset.id, asset.type as FlowAssetType]),
    ),
  }
}

function validationError(issues: Array<{
  code: string
  field: string
  params?: Record<string, boolean | number | string>
}>) {
  return new HttpError(
    400,
    'validation_error',
    'The Flow graph could not be validated.',
    issues.map(item => ({
      ...item,
      message: item.code,
    })),
  )
}

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

export async function createFlow(input: {
  createdBy: string
  name: string
  organizationId: string
}) {
  return presentFlow(await insertFlowRow({ ...input, id: createId() }))
}

export async function getFlow(organizationId: string, id: string) {
  const flow = await findFlowById(organizationId, id)
  if (!flow)
    throw new TenantResourceNotFoundError()
  return presentFlow(flow)
}

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

export async function deleteFlow(organizationId: string, id: string) {
  if (!await deleteFlowRow(organizationId, id))
    throw new TenantResourceNotFoundError()
}

export async function getFlowGraph(organizationId: string, flowId: string) {
  const graph = await getFlowGraphRows(
    db,
    organizationId,
    flowId,
  )
  if (!graph)
    throw new TenantResourceNotFoundError()
  const nodes = graph.nodes.map(presentNode)

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
  }
}

export async function getFlowReferences(
  organizationId: string,
  flowId: string,
): Promise<FlowReferencesResponse> {
  const graph = await getFlowGraphRows(db, organizationId, flowId)
  if (!graph)
    throw new TenantResourceNotFoundError()
  const nodes = graph.nodes.map(presentNode)
  const assetIds = [...new Set(nodes.flatMap(node => (
    node.assetId ? [node.assetId] : []
  )))]
  const hydration = await listFlowGraphHydrationRows({
    assetLimit: FLOW_GRAPH_LIMITS.referenceAssets,
    assetIds,
    organizationId,
  })
  if (hydration.limitExceeded) {
    throw validationError([{
      code: 'reference_asset_limit',
      field: 'assets',
      params: { maximum: FLOW_GRAPH_LIMITS.referenceAssets },
    }])
  }
  const presentedAssets = await Promise.all(hydration.assets.map(asset => (
    presentAsset(asset, undefined, { includeOriginalUrl: false })
  )))

  return {
    assets: presentedAssets.map((asset, index) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      source: asset.source,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      durationSeconds: asset.durationSeconds,
      lifecycle: asset.lifecycle,
      processingState: asset.processingState,
      processingError: asset.processingError,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      createdAt: asset.createdAt,
      generationModel: hydration.assets[index]?.generationModel ?? null,
    })),
  }
}

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
    throw validationError([{
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
        throw validationError(validation.issues)

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
