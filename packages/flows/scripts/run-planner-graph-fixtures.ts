import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowNodeType,
} from '../src/index.js'

import {
  getDefaultNodeData,
  getFlowNodeTypeDefinition,
} from '../src/index.js'

export function generationNode(
  id: string,
  type: Extract<
    FlowNodeType,
    'imageGeneration' | 'llm' | 'videoGeneration'
  > = 'llm',
  data: Record<string, unknown> = {},
  position = 0,
): FlowGraphNode {
  const definition = getFlowNodeTypeDefinition(type)
  return {
    assetId: null,
    data: { ...getDefaultNodeData(type), prompt: `prompt:${id}`, ...data },
    id,
    positionX: position,
    positionY: -position,
    schemaVersion: definition.currentVersion,
    type,
  }
}

export function sourceNode(
  id: string,
  type: 'asset' | 'text',
  assetId: null | string,
): FlowGraphNode {
  const definition = getFlowNodeTypeDefinition(type)
  return {
    assetId,
    data: type === 'text'
      ? { ...getDefaultNodeData(type), text: `text:${id}` }
      : getDefaultNodeData(type),
    id,
    positionX: 0,
    positionY: 0,
    schemaVersion: definition.currentVersion,
    type,
  }
}

export function edge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceHandle = 'text',
  targetHandle = 'prompt',
): FlowGraphEdge {
  return {
    createdAt: `2026-07-14T00:00:${id.padStart(2, '0')}Z`,
    id: `edge-${id}`,
    sourceHandle,
    sourceNodeId,
    targetHandle,
    targetNodeId,
  }
}
