/** Graph-scope expansion for node, upstream, and downstream mock previews. */

import type { CanvasEdge, CanvasNode } from '../../editor/flow-canvas-types'

import {
  getGenerationInputSlotsForNodeType,
  isAdaptiveGenerationNodeType,
} from '@talelabs/flows'
import { getCanvasGenerationModel } from '../../generation/flow-generation-contract'

/** Canvas-relative scope supported by the deterministic preview planner. */
export type FlowGenerationPreviewScope = 'fromHere' | 'node' | 'tillHere'

/** Returns the active model's input slots for one generation canvas node. */
export function generationInputSlots(node: CanvasNode) {
  const model = getCanvasGenerationModel(node)
  if (!model)
    return []
  return isAdaptiveGenerationNodeType(node.type)
    ? getGenerationInputSlotsForNodeType(model, node.type)
    : model.inputSlots
}

/** Selects generation preview nodes for node, direction, selection, or all scope. */
export function getMockRuntimePreviewNodeIds(
  input: {
    edges: readonly CanvasEdge[]
    nodes: readonly CanvasNode[]
  },
  nodeId: string,
  scope: FlowGenerationPreviewScope,
) {
  const nodeIds = new Set(input.nodes.map(node => node.id))
  if (!nodeIds.has(nodeId))
    return []
  if (scope === 'node')
    return [nodeId]

  const neighbors = new Map<string, string[]>()
  for (const edge of input.edges) {
    const from = scope === 'fromHere' ? edge.source : edge.target
    const to = scope === 'fromHere' ? edge.target : edge.source
    if (!nodeIds.has(from) || !nodeIds.has(to))
      continue
    neighbors.set(from, [...(neighbors.get(from) ?? []), to])
  }

  const included = new Set([nodeId])
  const queue = [nodeId]
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
  const incomingCount = new Map(includedNodes.map(node => [node.id, 0]))
  for (const edge of input.edges) {
    if (!included.has(edge.source) || !included.has(edge.target))
      continue
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) ?? []),
      edge.target,
    ])
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
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
    ...includedNodes.map(node => node.id).filter(id => !sortedIds.has(id)),
  ]
}
