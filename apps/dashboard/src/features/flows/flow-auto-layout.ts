import type { CanvasEdge, CanvasNode } from './flow-canvas-types'

import { Graph, layout } from '@dagrejs/dagre'

const DEFAULT_NODE_HEIGHT = 320
const DEFAULT_NODE_WIDTH = 360
const GRID_SIZE = 16

function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function getAutoLayoutedNodes(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
) {
  const graph = new Graph().setDefaultEdgeLabel(() => ({}))

  graph.setGraph({
    edgesep: 48,
    marginx: 32,
    marginy: 32,
    nodesep: 80,
    rankdir: 'LR',
    ranksep: 160,
  })

  for (const node of nodes) {
    graph.setNode(node.id, {
      height: node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT,
      width: node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH,
    })
  }

  for (const edge of edges)
    graph.setEdge(edge.source, edge.target)

  layout(graph)

  return nodes.map((node) => {
    const position = graph.node(node.id)
    const height = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT
    const width = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH

    return {
      ...node,
      position: {
        x: snapToGrid(position.x - width / 2),
        y: snapToGrid(position.y - height / 2),
      },
    }
  })
}
