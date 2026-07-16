import type { FlowRun } from '@talelabs/sdk'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'

import { isGenerationNodeType } from '@talelabs/flows'

export function activePreviewNodeIdsFromClosure(input: {
  edges: readonly CanvasEdge[]
  nodes: readonly CanvasNode[]
  previewNodeIds: readonly string[]
}) {
  const executableNodeIds = new Set(input.nodes
    .filter(node => input.previewNodeIds.includes(node.id))
    .filter(node => isGenerationNodeType(node.type))
    .map(node => node.id))
  return new Set(input.nodes
    .filter(node => executableNodeIds.has(node.id))
    .filter(node => !input.edges.some(edge =>
      edge.target === node.id && executableNodeIds.has(edge.source)))
    .map(node => node.id))
}

export function activeRunNodeIdsFromRun(input: {
  edges: readonly CanvasEdge[]
  run: FlowRun
}) {
  const nodesById = new Map(input.run.nodes.map(node => [node.nodeId, node]))
  const completedStatuses = new Set(['succeeded', 'skipped'])
  return new Set(input.run.nodes
    .filter((node) => {
      if (
        node.status === 'running'
        || node.items.some(item => item.status === 'running')
        || node.jobs.some(job => job.status === 'running')
      ) {
        return true
      }
      if (node.status !== 'pending')
        return false
      return !input.edges.some((edge) => {
        if (edge.target !== node.nodeId)
          return false
        const source = nodesById.get(edge.source)
        return source && !completedStatuses.has(source.status)
      })
    })
    .map(node => node.nodeId))
}
