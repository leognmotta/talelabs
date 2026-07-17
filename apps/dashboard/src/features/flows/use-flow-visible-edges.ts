/** Stable visual edge projection from semantic node and reference state. */

import type { FlowValueType } from '@talelabs/flows'
import type { CanvasStore } from './canvas-state/canvas-store'
import type { CanvasEdge, FlowReferenceData } from './flow-canvas-types'

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

/** Projects stable styled edges without reacting to position-only node changes. */
export function useFlowVisibleEdges(input: {
  edges: CanvasEdge[]
  referenceData: FlowReferenceData
  store: CanvasStore
}) {
  const nodes = input.store.getState().nodes
  const nodeSemantics = nodes.map(node => [
    node.id,
    node.assetId,
    node.type,
    node.data.modelId,
    node.data.modelContractVersion,
    node.data.operationId,
  ].join(':')).join('|')
  const semanticNodes = useMemo(() => {
    void nodeSemantics
    return input.store.getState().nodes
  }, [input.store, nodeSemantics])
  return useMemo(() => input.edges.filter((edge) => {
    const targetNode = semanticNodes.find(node => node.id === edge.target)
    return !(targetNode?.type === 'llm' && edge.targetHandle === 'instructions')
  }).map((edge) => {
    const sourceNode = semanticNodes.find(node => node.id === edge.source)
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
  }), [input.edges, input.referenceData, semanticNodes])
}
