import type { FlowValueType } from '@talelabs/flows'
import type { CanvasEdge, CanvasNode, FlowReferenceData } from './flow-canvas-types'

import { getFlowNodeHandles } from '@talelabs/flows'
import { useMemo } from 'react'
import { canvasNodeToGraphNode } from './flow-canvas-serialization'

const FLOW_VALUE_COLORS = {
  Asset: 'var(--flow-type-asset)',
  AudioSet: 'var(--flow-type-audio)',
  ElementContext: 'var(--flow-type-element)',
  ImageSet: 'var(--flow-type-image)',
  Text: 'var(--flow-type-text)',
  VideoSet: 'var(--flow-type-video)',
} as const satisfies Record<FlowValueType, string>

export function useFlowVisibleEdges(input: {
  edges: CanvasEdge[]
  nodes: CanvasNode[]
  referenceData: FlowReferenceData
}) {
  const nodesById = useMemo(
    () => new Map(input.nodes.map(node => [node.id, node])),
    [input.nodes],
  )
  return useMemo(() => input.edges.filter((edge) => {
    const targetNode = nodesById.get(edge.target)
    return !(targetNode?.type === 'llm' && edge.targetHandle === 'instructions')
  }).map((edge) => {
    const sourceNode = nodesById.get(edge.source)
    const sourceHandle = sourceNode
      ? getFlowNodeHandles(
          canvasNodeToGraphNode(sourceNode),
          input.referenceData,
        ).find(handle =>
          handle.direction === 'output' && handle.id === edge.sourceHandle,
        )
      : undefined
    const valueType = sourceHandle?.valueTypes[0]
    return {
      ...edge,
      className: 'flow-edge',
      type: 'flow',
      style: {
        ...edge.style,
        stroke: edge.selected
          ? 'var(--flow-edge-selected)'
          : valueType
            ? FLOW_VALUE_COLORS[valueType]
            : 'var(--flow-type-asset)',
        strokeWidth: edge.selected ? 2.25 : 1.75,
      },
    }
  }), [input.edges, input.referenceData, nodesById])
}
