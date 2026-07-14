import type { GenerationInputSlotDefinition } from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowGenerationPreviewOutput,
  FlowReferenceData,
} from './flow-canvas-types'
import type { GenerationMockRequest as DashboardGenerationMockRequest } from './flow-generation-preview'

import {
  compareFlowEdgesByPriority,
  getGenerationInputSlotsForNodeType,
  isAdaptiveGenerationNodeType,
  isGenerationNodeType,
  resolveAdaptiveGenerationState,
  valueTypesToAssetTypes,
} from '@talelabs/flows'
import { getCanvasGenerationModel } from './flow-generation-contract'
import {
  createGenerationMockOutput,
  createLlmMockRequest,
  createMediaMockRequest,
  fingerprintGenerationMockRequest,
} from './flow-generation-preview'
import { getFlowInputState } from './flow-input-state'

export type FlowGenerationPreviewScope = 'fromHere' | 'node' | 'tillHere'

export interface FlowMockRuntimePlanner {
  createRequest: (nodeId: string) => DashboardGenerationMockRequest | null
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  getFingerprint: (nodeId: string) => null | string
  getPreviewNodeIds: (
    nodeId: string,
    scope: FlowGenerationPreviewScope,
  ) => string[]
}

interface FlowMockRuntimePlannerInput {
  edges: readonly CanvasEdge[]
  locale: string
  nodes: readonly CanvasNode[]
  previews: Readonly<Record<string, FlowGenerationPreview>>
  referenceData: FlowReferenceData
}

function generationInputSlots(node: CanvasNode) {
  const model = getCanvasGenerationModel(node)
  if (!model)
    return []
  return isAdaptiveGenerationNodeType(node.type)
    ? getGenerationInputSlotsForNodeType(model, node.type)
    : model.inputSlots
}

function getPreviewNodeIds(input: {
  edges: readonly CanvasEdge[]
  nodeId: string
  nodes: readonly CanvasNode[]
  scope: FlowGenerationPreviewScope
}) {
  const nodeIds = new Set(input.nodes.map(node => node.id))
  if (!nodeIds.has(input.nodeId))
    return []
  if (input.scope === 'node')
    return [input.nodeId]

  const neighbors = new Map<string, string[]>()
  for (const edge of input.edges) {
    const from = input.scope === 'fromHere' ? edge.source : edge.target
    const to = input.scope === 'fromHere' ? edge.target : edge.source
    if (!nodeIds.has(from) || !nodeIds.has(to))
      continue
    neighbors.set(from, [...(neighbors.get(from) ?? []), to])
  }

  const included = new Set([input.nodeId])
  const queue = [input.nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const neighbor of neighbors.get(current) ?? []) {
      if (included.has(neighbor))
        continue
      included.add(neighbor)
      queue.push(neighbor)
    }
  }

  const includedNodes = input.nodes.filter(node => included.has(node.id))
  const order = new Map(input.nodes.map((node, index) => [node.id, index]))
  const outgoing = new Map<string, string[]>()
  const incomingCount = new Map(
    includedNodes.map(node => [node.id, 0]),
  )
  for (const edge of input.edges) {
    if (!included.has(edge.source) || !included.has(edge.target))
      continue
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) ?? []),
      edge.target,
    ])
    incomingCount.set(
      edge.target,
      (incomingCount.get(edge.target) ?? 0) + 1,
    )
  }

  const ready = includedNodes
    .filter(node => incomingCount.get(node.id) === 0)
    .map(node => node.id)
  const sorted: string[] = []
  while (ready.length > 0) {
    ready.sort((left, right) => order.get(left)! - order.get(right)!)
    const current = ready.shift()!
    sorted.push(current)
    for (const target of outgoing.get(current) ?? []) {
      const nextCount = (incomingCount.get(target) ?? 0) - 1
      incomingCount.set(target, nextCount)
      if (nextCount === 0)
        ready.push(target)
    }
  }

  const sortedIds = new Set(sorted)
  return [
    ...sorted,
    ...includedNodes
      .map(node => node.id)
      .filter(id => !sortedIds.has(id)),
  ]
}

export function createFlowMockRuntimePlanner(
  input: FlowMockRuntimePlannerInput,
): FlowMockRuntimePlanner {
  const nodesById = new Map(input.nodes.map(node => [node.id, node]))
  const requestCache = new Map<string, DashboardGenerationMockRequest | null>()

  function incomingEdges(nodeId: string) {
    return input.edges
      .filter(edge => edge.target === nodeId && edge.targetHandle)
      .toSorted(compareFlowEdgesByPriority)
  }

  function currentGenerationOutput(
    nodeId: string,
    visiting: ReadonlySet<string>,
  ): FlowGenerationPreviewOutput | null {
    const preview = input.previews[nodeId]
    if (preview?.status !== 'succeeded')
      return null
    const request = createRequest(nodeId, visiting)
    if (
      !request
      || preview.fingerprint !== fingerprintGenerationMockRequest(request)
    ) {
      return null
    }
    return preview.output
  }

  function connectedTextValue(
    nodeId: string,
    slotId: string,
    visiting: ReadonlySet<string>,
  ) {
    const edge = incomingEdges(nodeId).find(
      item => item.targetHandle === slotId,
    )
    if (!edge)
      return null
    const source = nodesById.get(edge.source)
    if (source?.type === 'text')
      return String(source.data.text ?? '')
    if (source && isGenerationNodeType(source.type)) {
      const output = currentGenerationOutput(source.id, visiting)
      return output?.kind === 'text' ? output.text : ''
    }
    return ''
  }

  function executableInputCount(
    nodeId: string,
    slot: GenerationInputSlotDefinition,
    visiting: ReadonlySet<string>,
  ) {
    const target = nodesById.get(nodeId)
    if (!target)
      return 0
    const acceptsAssets = valueTypesToAssetTypes(slot.accepts).length > 0
    const staticInput = acceptsAssets
      ? getFlowInputState({
        edges: [...input.edges],
        nodeId,
        nodes: [...input.nodes],
        referenceData: input.referenceData,
        slotId: slot.id,
      })?.selectedAvailableCount ?? 0
      : 0
    let runtimeCount = staticInput

    for (const edge of incomingEdges(nodeId)) {
      if (edge.targetHandle !== slot.id)
        continue
      const source = nodesById.get(edge.source)
      if (!source)
        continue
      if (source.type === 'text') {
        if (
          slot.accepts.includes('Text')
          && String(source.data.text ?? '').trim().length > 0
        ) {
          runtimeCount += 1
        }
        continue
      }
      if (!isGenerationNodeType(source.type))
        continue
      const output = currentGenerationOutput(source.id, visiting)
      if (output && slot.accepts.includes(output.valueType))
        runtimeCount += 1
    }

    return runtimeCount
  }

  function createRequest(
    nodeId: string,
    visiting: ReadonlySet<string> = new Set(),
  ): DashboardGenerationMockRequest | null {
    if (requestCache.has(nodeId))
      return requestCache.get(nodeId) ?? null
    if (visiting.has(nodeId))
      return null
    const node = nodesById.get(nodeId)
    if (!node || !isGenerationNodeType(node.type))
      return null
    const model = getCanvasGenerationModel(node)
    if (!model)
      return null

    const nextVisiting = new Set(visiting).add(nodeId)
    const incoming = incomingEdges(nodeId)
    const connectionCounts: Record<string, number> = {}
    for (const edge of incoming) {
      const slotId = edge.targetHandle!
      connectionCounts[slotId] = (connectionCounts[slotId] ?? 0) + 1
    }
    const textInputs = Object.fromEntries(
      ['instructions', 'lyrics', 'prompt'].map((slotId) => {
        const connected = connectedTextValue(nodeId, slotId, nextVisiting)
        return [
          slotId,
          connected ?? String(node.data[slotId] ?? ''),
        ]
      }),
    )
    const slots = generationInputSlots(node)
    const itemCounts = Object.fromEntries(slots.map(slot => [
      slot.id,
      ['instructions', 'lyrics', 'prompt'].includes(slot.id)
        ? (String(textInputs[slot.id] ?? '').trim().length > 0 ? 1 : 0)
        : executableInputCount(nodeId, slot, nextVisiting),
    ]))
    const locale = input.locale

    let request: DashboardGenerationMockRequest | null
    if (node.type === 'llm') {
      const imageState = getFlowInputState({
        edges: [...input.edges],
        nodeId,
        nodes: [...input.nodes],
        referenceData: input.referenceData,
        slotId: 'imageReferences',
      })
      const availableImageIds = new Set(
        imageState?.candidates.map(candidate => candidate.assetId) ?? [],
      )
      const imageAssetIds = (imageState?.selectedAssetIds ?? [])
        .filter(assetId => availableImageIds.has(assetId))
        .slice(0, imageState?.maximum ?? 8)
      request = createLlmMockRequest({
        connectionCounts,
        imageAssetIds,
        instructions: textInputs.instructions ?? '',
        itemCounts,
        locale,
        model,
        node,
        prompt: textInputs.prompt ?? '',
      })
    }
    else {
      const resolution = resolveAdaptiveGenerationState({
        connectionCounts,
        inlineInstructions: textInputs.instructions ?? '',
        inlineLyrics: textInputs.lyrics ?? '',
        inlinePrompt: textInputs.prompt ?? '',
        itemCounts,
        model,
        nodeType: node.type,
        settings: node.data.settings ?? {},
      })
      if (resolution && (
        resolution.readiness !== 'ready'
        || !resolution.resolvedOperationId
      )) {
        requestCache.set(nodeId, null)
        return null
      }
      const settings = resolution && 'normalizedSettings' in resolution
        ? resolution.normalizedSettings
        : node.data.settings ?? {}
      const connectedSources = incoming.map((edge) => {
        const source = nodesById.get(edge.source)
        const output = source && isGenerationNodeType(source.type)
          ? currentGenerationOutput(source.id, nextVisiting)
          : null
        const sourceValue = source?.type === 'text'
          ? String(source.data.text ?? '')
          : output
            ? input.previews[source!.id]?.fingerprint ?? ''
            : source?.assetId ?? ''
        return [
          edge.source,
          edge.sourceHandle ?? '',
          edge.targetHandle ?? '',
          sourceValue,
        ].join(':')
      })
      const inputAssetIds = slots.flatMap(slot => (
        getFlowInputState({
          edges: [...input.edges],
          nodeId,
          nodes: [...input.nodes],
          referenceData: input.referenceData,
          slotId: slot.id,
        })?.selectedAssetIds ?? []
      ))
      request = createMediaMockRequest({
        connectedSources,
        connectionCounts,
        inputAssetIds,
        itemCounts,
        locale,
        model,
        node,
        operationId:
          resolution?.resolvedOperationId
          ?? String(node.data.operationId ?? ''),
        settings,
        textInputs,
      })
    }

    requestCache.set(nodeId, request)
    return request
  }

  return {
    createRequest: nodeId => createRequest(nodeId),
    getExecutableInputCount: (nodeId, slotId) => {
      const node = nodesById.get(nodeId)
      const slot = node
        ? generationInputSlots(node).find(item => item.id === slotId)
        : undefined
      return slot ? executableInputCount(nodeId, slot, new Set([nodeId])) : 0
    },
    getFingerprint: (nodeId) => {
      const request = createRequest(nodeId)
      return request ? fingerprintGenerationMockRequest(request) : null
    },
    getPreviewNodeIds: (nodeId, scope) => getPreviewNodeIds({
      edges: input.edges,
      nodeId,
      nodes: input.nodes,
      scope,
    }),
  }
}

export async function runFlowGenerationMockPreview(input: {
  nodeId: string
  planner: FlowMockRuntimePlanner
  t: TFunction
  updatePreview: (nodeId: string, preview: FlowGenerationPreview) => void
}) {
  const request = input.planner.createRequest(input.nodeId)
  if (!request)
    return false
  const fingerprint = fingerprintGenerationMockRequest(request)
  input.updatePreview(input.nodeId, { fingerprint, status: 'pending' })
  try {
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function')
        requestAnimationFrame(() => resolve())
      else
        queueMicrotask(resolve)
    })
    // TODO(provider-integration): Replace only this deterministic mock result boundary after canvas UX approval.
    const output = createGenerationMockOutput(request, input.t)
    input.updatePreview(input.nodeId, {
      fingerprint,
      output,
      status: 'succeeded',
    })
    return true
  }
  catch {
    input.updatePreview(input.nodeId, {
      errorKey: 'flows.llm.preview.error',
      fingerprint,
      status: 'error',
    })
    return false
  }
}
