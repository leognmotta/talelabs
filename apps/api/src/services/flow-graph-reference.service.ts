/**
 * Flow graph node/edge presentation, Element-ID collection, validation-context
 * construction, and reference (asset + Element) hydration. Kept apart from
 * `flows.service.ts` so run planning can build a validation context without
 * pulling in Flow CRUD, and so graph-reference concerns own one focused file.
 */

import type {
  AssetSource,
  AssetType,
  AssetVisibility,
  JsonValue,
} from '@talelabs/db'
import type {
  FlowAssetType,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowNodeType,
} from '@talelabs/flows'

import { db } from '@talelabs/db'
import {
  FLOW_GRAPH_LIMITS,
  getElementNodeElementId,
  isFlowNodeType,
  parseAndUpcastFlowNodeData,
} from '@talelabs/flows'

import {
  listElementReferenceIdsByElement,
  listElementRowsByIds,
} from '../data/elements.data.js'
import {
  getFlowGraphRows,
  listFlowGraphHydrationRows,
  listFlowGraphReferenceRows,
} from '../data/flows.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
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
  visibility: AssetVisibility
  thumbnailUrl: null | string
  type: AssetType
  url: null | string
  width: null | number
}

interface FlowReferenceElementResponse {
  id: string
  kind: string
  name: string
  referenceAssetIds: string[]
}

interface FlowReferencesResponse {
  assets: FlowReferenceAssetResponse[]
  elements: FlowReferenceElementResponse[]
}

/** Builds a Flow-graph validation error from raw issues. */
export function flowGraphValidationError(issues: Array<{
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

/** Presents one stored Flow node row as its parsed, upcast wire shape. */
export function presentNode(node: {
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

/** Presents one stored Flow edge row as its wire shape. */
export function presentEdge(edge: {
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

/** Element IDs referenced by element nodes in one graph. */
export function collectGraphElementIds(nodes: readonly FlowGraphNode[]) {
  return [...new Set(nodes.flatMap((node) => {
    const elementId = getElementNodeElementId(node)
    return elementId ? [elementId] : []
  }))]
}

/**
 * Resolves the graph validation context: Asset media types for Asset nodes
 * plus ordered reference Asset IDs for every resolvable Element. Unknown
 * Element IDs stay absent so drafts persist and only runs are blocked.
 */
export async function buildFlowGraphValidationContext(input: {
  executor: Parameters<typeof listFlowGraphReferenceRows>[0]
  nodes: readonly FlowGraphNode[]
  organizationId: string
}): Promise<FlowGraphValidationContext> {
  const elements = await listElementRowsByIds(
    input.executor,
    input.organizationId,
    collectGraphElementIds(input.nodes),
  )
  const elementReferencesById = await listElementReferenceIdsByElement(
    input.executor,
    input.organizationId,
    elements.map(element => element.id),
  )
  for (const element of elements)
    elementReferencesById[element.id] ??= []

  const assetIds = new Set(
    input.nodes.flatMap(node => node.assetId ? [node.assetId] : []),
  )
  for (const referenceIds of Object.values(elementReferencesById)) {
    for (const assetId of referenceIds)
      assetIds.add(assetId)
  }
  const rows = await listFlowGraphReferenceRows(input.executor, {
    assetIds: [...assetIds],
    organizationId: input.organizationId,
  })

  return {
    assetTypesById: Object.fromEntries(
      rows.assets.map(asset => [asset.id, asset.type as FlowAssetType]),
    ),
    elementReferencesById,
  }
}

/**
 * Validation context that additionally asserts every Asset node resolves to a
 * tenant-owned Asset, throwing a field-scoped not-found otherwise.
 */
export async function getValidationContext(input: {
  executor: Parameters<typeof listFlowGraphReferenceRows>[0]
  nodes: FlowGraphNode[]
  organizationId: string
}): Promise<FlowGraphValidationContext> {
  const context = await buildFlowGraphValidationContext(input)

  for (const node of input.nodes) {
    if (node.assetId && !context.assetTypesById[node.assetId])
      throw new TenantResourceNotFoundError(`nodes.${node.id}.assetId`)
  }

  return context
}

/** Hydrates a Flow's referenced Assets and Elements for the canvas. */
export async function getFlowReferences(
  organizationId: string,
  flowId: string,
): Promise<FlowReferencesResponse> {
  const graph = await getFlowGraphRows(db, organizationId, flowId)
  if (!graph)
    throw new TenantResourceNotFoundError()
  const nodes = graph.nodes.map(presentNode)
  const elements = await listElementRowsByIds(
    db,
    organizationId,
    collectGraphElementIds(nodes),
  )
  const elementReferencesById = await listElementReferenceIdsByElement(
    db,
    organizationId,
    elements.map(element => element.id),
  )
  const assetIds = [...new Set([
    ...nodes.flatMap(node => node.assetId ? [node.assetId] : []),
    ...Object.values(elementReferencesById).flat(),
  ])]
  const hydration = await listFlowGraphHydrationRows({
    assetLimit: FLOW_GRAPH_LIMITS.referenceAssets,
    assetIds,
    organizationId,
  })
  if (hydration.limitExceeded) {
    throw flowGraphValidationError([{
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
      visibility: asset.visibility,
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
    elements: elements.map(element => ({
      id: element.id,
      kind: element.kind,
      name: element.name,
      referenceAssetIds: elementReferencesById[element.id] ?? [],
    })),
  }
}
