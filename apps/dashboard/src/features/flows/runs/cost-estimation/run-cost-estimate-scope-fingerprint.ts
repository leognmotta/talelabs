/** Cost-relevant Flow-scope fingerprints used to retain unrelated estimates. */

import type {
  FlowRunCommand,
  FlowRunGraphSelectionIndex,
  NormalizedFlowRunCommand,
} from '@talelabs/flows'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowReferenceData,
} from '../../editor/flow-canvas-types'

import {
  createFlowRunGraphSelectionIndex,
  hashCanonicalValue,
  isGenerationNodeType,
  selectFlowRunGraph,
} from '@talelabs/flows'
import { toPersistedGraph } from '../../editor/persistence/flow-graph-serialization'

const RUN_COST_SCOPE_HASH_DOMAIN = 'talelabs:run-cost-scope:v1'
const RUN_COST_SOURCE_HASH_DOMAIN = 'talelabs:run-cost-source:v1'

type PersistedGraph = ReturnType<typeof toPersistedGraph>

/** Saved cost-scope fingerprints calculated once for one canvas graph state. */
export interface RunCostEstimateScopeIndex {
  /** Whole-Flow estimate scope when requested by the current batch. */
  all?: string
  /** Direct-node estimate scopes keyed by generation node id. */
  nodes: Readonly<Record<string, string>>
  /** Coarse graph fingerprint used to skip repeated work for position-only edits. */
  source: string
}

/** Serialized graph facts reused while fingerprinting several requested scopes. */
export interface RunCostEstimateFingerprintSource {
  /** Persisted graph projection excluding canvas-only presentation state. */
  graph: PersistedGraph
  /** Latest successful generation previews used by partial-run scopes. */
  priorResultsByNodeId?: Readonly<Record<string, FlowGenerationPreview | undefined>>
  /** Current Asset and Element metadata used by scope fingerprints. */
  referenceData: FlowReferenceData
  /** Shared adjacency and executable-node index for the exact graph. */
  selectionIndex: FlowRunGraphSelectionIndex
  /** Coarse cost-relevant identity for the entire graph source. */
  source: string
}

/** Normalizes selection order so equivalent run commands share one estimate. */
export function normalizeRunCostEstimateCommand(
  command: FlowRunCommand,
): NormalizedFlowRunCommand {
  if (command.mode !== 'selection')
    return command
  return {
    mode: 'selection',
    selectedNodeIds: [...new Set(command.selectedNodeIds)].toSorted(),
  }
}

function costRelevantNode(node: PersistedGraph['nodes'][number]) {
  const { locked: _locked, ...data } = node.data
  return {
    assetId: node.assetId,
    data,
    id: node.id,
    schemaVersion: node.schemaVersion,
    type: node.type,
  }
}

function costRelevantPreview(preview: FlowGenerationPreview | undefined) {
  const output = preview?.output
    ? preview.output.kind === 'text'
      ? {
          kind: preview.output.kind,
          text: preview.output.text,
          valueType: preview.output.valueType,
        }
      : {
          assetId: preview.output.assetId ?? null,
          kind: preview.output.kind,
          mediaType: preview.output.mediaType,
          valueType: preview.output.valueType,
        }
    : null
  const resultSets = preview?.resultSets?.map(result => ({
    itemKey: result.itemKey,
    outputs: result.outputs.map(item => ({
      output: item.output.kind === 'text'
        ? {
            kind: item.output.kind,
            text: item.output.text,
            valueType: item.output.valueType,
          }
        : {
            assetId: item.output.assetId ?? null,
            kind: item.output.kind,
            mediaType: item.output.mediaType,
            valueType: item.output.valueType,
          },
      outputIndex: item.outputIndex,
    })),
  })) ?? []
  return { output, resultSets }
}

function costRelevantAsset(
  assetId: string,
  referenceData: FlowReferenceData,
) {
  const asset = referenceData.assetsById.get(assetId)
  return asset
    ? {
        durationSeconds: asset.durationSeconds,
        height: asset.height,
        id: asset.id,
        lifecycle: asset.lifecycle,
        processingState: asset.processingState,
        type: asset.type,
        width: asset.width,
      }
    : { id: assetId, missing: true as const }
}

function createScopeFingerprint(input: {
  command: NormalizedFlowRunCommand
  graph: PersistedGraph
  priorResultsByNodeId?: Readonly<Record<string, FlowGenerationPreview | undefined>>
  referenceData: FlowReferenceData
  selectionIndex: FlowRunGraphSelectionIndex
}): string {
  const selection = selectFlowRunGraph({
    command: input.command,
    edges: input.graph.edges,
    index: input.selectionIndex,
    nodes: input.graph.nodes,
  })
  const capturedNodeIds = new Set(selection.capturedNodeIds)
  const capturedEdgeIds = new Set(selection.capturedEdgeIds)
  const plannedNodeIds = new Set(
    selection.executableNodes.map(node => node.nodeId),
  )
  const nodes = input.graph.nodes
    .filter(node => capturedNodeIds.has(node.id))
    .toSorted((left, right) => left.id.localeCompare(right.id))
  const assetIds = new Set<string>()
  const elements: Array<
    | { id: string, missing: true }
    | { id: string, referenceAssetIds: readonly string[] }
  > = []
  for (const node of nodes) {
    if (node.assetId)
      assetIds.add(node.assetId)
    if (node.type !== 'element' || typeof node.data.elementId !== 'string')
      continue
    const element = input.referenceData.elementsById.get(node.data.elementId)
    if (!element) {
      elements.push({
        id: node.data.elementId,
        missing: true,
      })
      continue
    }
    for (const assetId of element.referenceAssetIds)
      assetIds.add(assetId)
    elements.push({
      id: element.id,
      referenceAssetIds: element.referenceAssetIds,
    })
  }
  elements.sort((left, right) => left.id.localeCompare(right.id))

  return hashCanonicalValue(RUN_COST_SCOPE_HASH_DOMAIN, {
    assets: [...assetIds]
      .toSorted()
      .map(assetId => costRelevantAsset(assetId, input.referenceData)),
    command: input.command,
    edges: input.graph.edges.filter(edge => capturedEdgeIds.has(edge.id)),
    elements,
    nodes: nodes.map(costRelevantNode),
    priorResults: nodes.flatMap(node => (
      isGenerationNodeType(node.type) && !plannedNodeIds.has(node.id)
        ? [{
            nodeId: node.id,
            result: costRelevantPreview(input.priorResultsByNodeId?.[node.id]),
          }]
        : []
    )),
    version: 2,
  })
}

function createSourceFingerprint(input: {
  graph: PersistedGraph
  priorResultsByNodeId?: Readonly<Record<string, FlowGenerationPreview | undefined>>
  referenceData: FlowReferenceData
}): string {
  const assetIds = new Set<string>()
  const elementIds = new Set<string>()
  for (const node of input.graph.nodes) {
    if (node.assetId)
      assetIds.add(node.assetId)
    if (node.type === 'element' && typeof node.data.elementId === 'string')
      elementIds.add(node.data.elementId)
  }
  const elements = [...elementIds].toSorted().map((elementId) => {
    const element = input.referenceData.elementsById.get(elementId)
    if (!element)
      return { id: elementId, missing: true as const }
    for (const assetId of element.referenceAssetIds)
      assetIds.add(assetId)
    return { id: element.id, referenceAssetIds: element.referenceAssetIds }
  })
  return hashCanonicalValue(RUN_COST_SOURCE_HASH_DOMAIN, {
    assets: [...assetIds]
      .toSorted()
      .map(assetId => costRelevantAsset(assetId, input.referenceData)),
    edges: input.graph.edges,
    elements,
    nodes: input.graph.nodes.map(costRelevantNode),
    priorResults: input.graph.nodes.flatMap(node => (
      isGenerationNodeType(node.type)
        ? [{
            nodeId: node.id,
            result: costRelevantPreview(input.priorResultsByNodeId?.[node.id]),
          }]
        : []
    )),
    version: 1,
  })
}

/**
 * Hashes only the graph slice and Asset metadata captured by one run command.
 * Canvas position, lock state, selection, and unrelated nodes are excluded.
 */
export function createRunCostEstimateScopeFingerprint(input: {
  /** Provider-neutral run command whose selected graph determines the scope. */
  command: NormalizedFlowRunCommand
  /** Current canvas connections before the saved-revision preflight. */
  edges: CanvasEdge[]
  /** Current canvas nodes before the saved-revision preflight. */
  nodes: CanvasNode[]
  /** Latest successful outputs that unselected executable ancestors may supply. */
  priorResultsByNodeId?: Readonly<Record<string, FlowGenerationPreview | undefined>>
  /** Reference metadata that may change configuration-sensitive pricing. */
  referenceData: FlowReferenceData
}): string {
  const source = createRunCostEstimateFingerprintSource(input)
  return createScopeFingerprint({
    command: input.command,
    graph: source.graph,
    priorResultsByNodeId: source.priorResultsByNodeId,
    referenceData: source.referenceData,
    selectionIndex: source.selectionIndex,
  })
}

/** Builds one reusable serialized and indexed source for requested fingerprints. */
export function createRunCostEstimateFingerprintSource(input: {
  /** Current canvas connections. */
  edges: CanvasEdge[]
  /** Current canvas nodes. */
  nodes: CanvasNode[]
  /** Latest successful outputs available to direct-node runs. */
  priorResultsByNodeId?: Readonly<Record<string, FlowGenerationPreview | undefined>>
  /** Reference metadata that may affect configuration-sensitive pricing. */
  referenceData: FlowReferenceData
}): RunCostEstimateFingerprintSource {
  const graph = toPersistedGraph(input.nodes, input.edges)
  const source = createSourceFingerprint({
    graph,
    priorResultsByNodeId: input.priorResultsByNodeId,
    referenceData: input.referenceData,
  })
  return {
    graph,
    priorResultsByNodeId: input.priorResultsByNodeId,
    referenceData: input.referenceData,
    selectionIndex: createFlowRunGraphSelectionIndex({
      edges: graph.edges,
      nodes: graph.nodes,
    }),
    source,
  }
}

/** Builds only the requested eager-scope fingerprints from one indexed graph. */
export function createRunCostEstimateScopeIndex(input: {
  /** Whether this batch includes the whole-Flow estimate. */
  includeAll: boolean
  /** Direct generation-node scopes included in this bounded batch. */
  nodeIds: readonly string[]
  /** Previously calculated scopes reusable for this exact source. */
  previous?: RunCostEstimateScopeIndex
  /** Serialized graph and shared dependency index. */
  source: RunCostEstimateFingerprintSource
}): RunCostEstimateScopeIndex {
  const previous = input.previous?.source === input.source.source
    ? input.previous
    : undefined
  let all = previous?.all
  if (input.includeAll && !all) {
    all = createScopeFingerprint({
      command: { mode: 'all' },
      graph: input.source.graph,
      priorResultsByNodeId: input.source.priorResultsByNodeId,
      referenceData: input.source.referenceData,
      selectionIndex: input.source.selectionIndex,
    })
  }
  const generationNodeIds = new Set(
    input.source.graph.nodes
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id),
  )
  const nodes = Object.fromEntries(
    [...new Set(input.nodeIds)]
      .filter(nodeId => generationNodeIds.has(nodeId))
      .toSorted()
      .map((nodeId) => {
        const fingerprint = previous?.nodes[nodeId] ?? createScopeFingerprint({
          command: { mode: 'node', targetNodeId: nodeId },
          graph: input.source.graph,
          priorResultsByNodeId: input.source.priorResultsByNodeId,
          referenceData: input.source.referenceData,
          selectionIndex: input.source.selectionIndex,
        })
        return [nodeId, fingerprint]
      }),
  )
  const accumulatedNodes = { ...previous?.nodes, ...nodes }
  return {
    ...(all ? { all } : {}),
    nodes: accumulatedNodes,
    source: input.source.source,
  }
}
