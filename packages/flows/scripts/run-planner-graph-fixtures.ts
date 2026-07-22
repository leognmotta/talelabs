/** Canonical graph-node and edge fixtures for run-planner verification. */

import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowNodeType,
} from '../src/index.js'

import {
  coercePromptTemplate,
  getDefaultNodeData,
  getFlowNodeTypeDefinition,
} from '../src/index.js'

/** Creates one current-version executable node with a structured prompt. */
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
  const prompt = coercePromptTemplate(data.prompt ?? `prompt:${id}`)
  return {
    assetId: null,
    data: { ...getDefaultNodeData(type), ...data, prompt },
    id,
    positionX: position,
    positionY: -position,
    schemaVersion: definition.currentVersion,
    type,
  }
}

/** Creates one current-version Asset or Text source node. */
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

/** Creates one deterministically ordered graph edge between fixture nodes. */
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
