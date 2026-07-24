/** One Flow-scoped index for narrow generation prompt-input subscriptions. */

import type { GenerationInputSlotDefinition } from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type { PromptComposerInput } from '../../../../generation/prompt-composer/prompt-composer-types'
import type { CanvasStore } from '../../../editor/canvas-state/canvas-store'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowReferenceData,
} from '../../../editor/flow-canvas-types'

import {
  compareFlowEdgesByPriority,
  getActiveGenerationInputSlots,
  getGenerationInputSlotsForNodeType,
  isAdaptiveGenerationNodeType,
} from '@talelabs/flows'
import { getCanvasGenerationModel } from '../../../generation/flow-generation-contract'
import { getFlowInputState } from '../../../generation/flow-input-state'
import {
  haveSamePromptInputEdgeSemantics,
  haveSamePromptInputNodeSemantics,
  haveSamePromptInputPreviewSemantics,
  haveSamePromptInputs,
} from './generation-prompt-input-semantics'
import { generationPromptInputs } from './generation-prompt-inputs'

const EMPTY_PROMPT_INPUTS: readonly PromptComposerInput[] = Object.freeze([])

interface PromptInputGraphIndex {
  edgesById: ReadonlyMap<string, CanvasEdge>
  incomingEdgesByTargetId: ReadonlyMap<string, readonly CanvasEdge[]>
  nodesById: ReadonlyMap<string, CanvasNode>
  sourceTargetIds: ReadonlyMap<string, ReadonlySet<string>>
}

interface GenerationPromptInputIndexSource {
  getGenerationPreview: (nodeId: string) => FlowGenerationPreview | undefined
  referenceData: FlowReferenceData
  store: CanvasStore
  subscribeGenerationPreviews: (listener: () => void) => () => void
  t: TFunction
}

/** Per-target external-store API consumed by mounted generation nodes. */
export interface GenerationPromptInputIndex {
  /** Reads one stable prompt-input slice, deriving it lazily on first access. */
  getSnapshot: (nodeId: string) => readonly PromptComposerInput[]
  /** Starts the single canvas and preview subscriptions for this Flow. */
  start: () => () => void
  /** Observes changes to only one target node's prompt-input slice. */
  subscribe: (nodeId: string, listener: () => void) => () => void
}

function createPromptInputGraphIndex(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): PromptInputGraphIndex {
  const incomingEdgesByTargetId = new Map<string, CanvasEdge[]>()
  const sourceTargetIds = new Map<string, Set<string>>()
  for (const edge of edges) {
    const incoming = incomingEdgesByTargetId.get(edge.target) ?? []
    incoming.push(edge)
    incomingEdgesByTargetId.set(edge.target, incoming)
    const targets = sourceTargetIds.get(edge.source) ?? new Set<string>()
    targets.add(edge.target)
    sourceTargetIds.set(edge.source, targets)
  }
  for (const incoming of incomingEdgesByTargetId.values())
    incoming.sort(compareFlowEdgesByPriority)
  return {
    edgesById: new Map(edges.map(edge => [edge.id, edge])),
    incomingEdgesByTargetId,
    nodesById: new Map(nodes.map(node => [node.id, node])),
    sourceTargetIds,
  }
}

function graphPreservesPromptInputSemantics(
  graph: PromptInputGraphIndex,
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): boolean {
  if (
    graph.nodesById.size !== nodes.length
    || graph.edgesById.size !== edges.length
  ) {
    return false
  }
  return nodes.every((node) => {
    const previous = graph.nodesById.get(node.id)
    return previous && haveSamePromptInputNodeSemantics(previous, node)
  }) && edges.every((edge) => {
    const previous = graph.edgesById.get(edge.id)
    return previous && haveSamePromptInputEdgeSemantics(previous, edge)
  })
}

function activePromptInputSlots(
  node: CanvasNode,
): readonly GenerationInputSlotDefinition[] {
  const model = getCanvasGenerationModel(node)
  if (!model)
    return []
  const availableSlots = isAdaptiveGenerationNodeType(node.type)
    ? getGenerationInputSlotsForNodeType(model, node.type)
    : model.inputSlots
  const activeSlotIds = new Set(
    getActiveGenerationInputSlots(model, node.data.operationId)
      .map(slot => slot.id),
  )
  return availableSlots.filter(slot => activeSlotIds.has(slot.id))
}

class GenerationPromptInputIndexStore implements GenerationPromptInputIndex {
  private readonly source: GenerationPromptInputIndexSource

  private graph: PromptInputGraphIndex

  private observedEdges: readonly CanvasEdge[]

  private observedNodes: readonly CanvasNode[]

  private readonly listenersByNodeId = new Map<string, Set<() => void>>()
  private readonly previewsBySourceId = new Map<
    string,
    FlowGenerationPreview | undefined
  >()

  private readonly snapshotsByNodeId = new Map<
    string,
    readonly PromptComposerInput[]
  >()

  constructor(source: GenerationPromptInputIndexSource) {
    this.source = source
    const state = source.store.getState()
    this.observedEdges = state.edges
    this.observedNodes = state.nodes
    this.graph = createPromptInputGraphIndex(state.nodes, state.edges)
    this.captureSourcePreviews()
  }

  getSnapshot = (nodeId: string): readonly PromptComposerInput[] => {
    const current = this.snapshotsByNodeId.get(nodeId)
    if (current)
      return current
    const next = this.deriveSnapshot(nodeId)
    this.snapshotsByNodeId.set(nodeId, next)
    return next
  }

  start = () => {
    const unsubscribeCanvas = this.source.store.subscribe((state) => {
      this.handleCanvasChange(state.nodes, state.edges)
    })
    const unsubscribePreviews = this.source.subscribeGenerationPreviews(
      this.handlePreviewChange,
    )
    const state = this.source.store.getState()
    this.handleCanvasChange(state.nodes, state.edges)
    this.handlePreviewChange()
    return () => {
      unsubscribeCanvas()
      unsubscribePreviews()
    }
  }

  subscribe = (nodeId: string, listener: () => void) => {
    const listeners = this.listenersByNodeId.get(nodeId)
      ?? new Set<() => void>()
    listeners.add(listener)
    this.listenersByNodeId.set(nodeId, listeners)
    this.getSnapshot(nodeId)
    return () => {
      listeners.delete(listener)
      if (listeners.size > 0)
        return
      this.listenersByNodeId.delete(nodeId)
      this.snapshotsByNodeId.delete(nodeId)
    }
  }

  private captureSourcePreviews() {
    this.previewsBySourceId.clear()
    for (const sourceNodeId of this.graph.sourceTargetIds.keys()) {
      this.previewsBySourceId.set(
        sourceNodeId,
        this.source.getGenerationPreview(sourceNodeId),
      )
    }
  }

  private deriveSnapshot(nodeId: string): readonly PromptComposerInput[] {
    const node = this.graph.nodesById.get(nodeId)
    if (!node)
      return EMPTY_PROMPT_INPUTS
    const incomingEdges = this.graph.incomingEdgesByTargetId.get(nodeId) ?? []
    return generationPromptInputs({
      canvas: {
        getGenerationPreview: this.source.getGenerationPreview,
        getInputState: (targetNodeId, slotId) => {
          const targetNode = this.graph.nodesById.get(targetNodeId)
          if (!targetNode)
            return null
          return getFlowInputState({
            incomingEdges: this.graph.incomingEdgesByTargetId.get(
              targetNodeId,
            ) ?? [],
            nodesById: this.graph.nodesById,
            referenceData: this.source.referenceData,
            slotId,
            targetNode,
          })
        },
        getNode: sourceNodeId => this.graph.nodesById.get(sourceNodeId),
        referenceData: this.source.referenceData,
      },
      edges: incomingEdges,
      node,
      slots: activePromptInputSlots(node),
      t: this.source.t,
    })
  }

  private handleCanvasChange(
    nodes: readonly CanvasNode[],
    edges: readonly CanvasEdge[],
  ) {
    if (nodes === this.observedNodes && edges === this.observedEdges)
      return
    this.observedNodes = nodes
    this.observedEdges = edges
    if (graphPreservesPromptInputSemantics(this.graph, nodes, edges))
      return
    this.graph = createPromptInputGraphIndex(nodes, edges)
    this.captureSourcePreviews()
    this.recomputeSnapshots(this.snapshotsByNodeId.keys())
  }

  private handlePreviewChange = () => {
    const affectedTargetIds = new Set<string>()
    for (const [sourceNodeId, targetNodeIds] of this.graph.sourceTargetIds) {
      const previous = this.previewsBySourceId.get(sourceNodeId)
      const next = this.source.getGenerationPreview(sourceNodeId)
      if (haveSamePromptInputPreviewSemantics(previous, next))
        continue
      this.previewsBySourceId.set(sourceNodeId, next)
      for (const targetNodeId of targetNodeIds)
        affectedTargetIds.add(targetNodeId)
    }
    this.recomputeSnapshots(affectedTargetIds)
  }

  private recomputeSnapshots(nodeIds: Iterable<string>) {
    for (const nodeId of [...nodeIds]) {
      const previous = this.snapshotsByNodeId.get(nodeId)
      if (!previous)
        continue
      const next = this.deriveSnapshot(nodeId)
      if (haveSamePromptInputs(previous, next))
        continue
      this.snapshotsByNodeId.set(nodeId, next)
      for (const listener of this.listenersByNodeId.get(nodeId) ?? [])
        listener()
    }
  }
}

/** Creates one prompt-input coordinator for one mounted Flow canvas. */
export function createGenerationPromptInputIndex(
  source: GenerationPromptInputIndexSource,
): GenerationPromptInputIndex {
  return new GenerationPromptInputIndexStore(source)
}
