/**
 * Provider-neutral input materialization for selected Flow execution nodes.
 *
 * Static text, Asset inputs, and locked prior outputs are captured here.
 * Same-run outputs remain explicit deferred bindings for topological expansion.
 */

import type { GenerationModelDefinition } from '../../generation/registry/types.js'
import type { FlowGraphNode, FlowNodeType } from '../../graph/types.js'
import type {
  FlowItem,
  FlowRuntimeValue,
  PriorNodeOutputDescriptor,
} from '../values/runtime-values.js'
import type {
  FlowRunPlanningStageResult,
  PlannedPriorOutputRequirement,
  PlannedStaticAssetPrerequisite,
} from './planner-contracts.js'
import type { FlowRunInclusionReason, FlowRunPlanningIssue } from './run-command.js'
import type { PreparedSelectedGraph } from './selected-graph-preparation.js'

import {
  getGenerationModel,
  getGenerationOperation,
  isGenerationNodeType,
} from '../../generation/registry/index.js'
import { getFlowNodeHandles } from '../../graph/handles.js'
import { createStaticAssetItem } from '../values/runtime-collections.js'
import { createStaticTextItem } from '../values/runtime-text.js'
import {
  generationOutputCount,
  normalizedGenerationSettings,
} from './planner-node-data.js'
import { resolvePriorOutput } from './planner-outputs.js'

/** One captured or deferred input consumed by job expansion. */
export type MaterializedFlowRunInput = {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  source: 'captured'
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
} | {
  edgeId: string
  source: 'sameRunOutput'
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

/** One selected execution node with immutable provider-neutral input facts. */
export interface MaterializedExecutionNode {
  inclusionReason: FlowRunInclusionReason
  inputs: readonly MaterializedFlowRunInput[]
  level: number
  model: GenerationModelDefinition
  node: FlowGraphNode
  nodeType: FlowNodeType
  operationId: string
  outputCount: number
  outputHandleId: string
  outputValueType: string
  settings: Readonly<Record<string, boolean | number | string>>
}

/** Complete materialization consumed by deterministic job expansion. */
export interface FlowRunExecutionMaterialization {
  /** Stable issues accumulated while locking prior outputs and static inputs. */
  issues: readonly FlowRunPlanningIssue[]
  nodes: readonly MaterializedExecutionNode[]
  priorOutputRequirements: readonly PlannedPriorOutputRequirement[]
  staticAssetPrerequisites: readonly PlannedStaticAssetPrerequisite[]
}

/** Captures all non-provider execution inputs for the selected graph. */
export function materializeFlowRunExecution(
  prepared: PreparedSelectedGraph,
): FlowRunPlanningStageResult<FlowRunExecutionMaterialization> {
  const { input, nodesById, plannedExecutableIds, selection } = prepared
  const selectedById = new Map(
    selection.executableNodes.map(node => [node.nodeId, node]),
  )
  const incomingByNodeId = new Map<string, typeof prepared.capturedEdges[number][]>()
  for (const edge of prepared.capturedEdges) {
    incomingByNodeId.set(edge.targetNodeId, [
      ...(incomingByNodeId.get(edge.targetNodeId) ?? []),
      edge,
    ])
  }

  const priorOutputsByNodeHandle = new Map<string, PriorNodeOutputDescriptor[]>()
  for (const output of input.priorOutputs ?? []) {
    const key = `${output.nodeId}\u0000${output.outputHandleId}`
    priorOutputsByNodeHandle.set(key, [
      ...(priorOutputsByNodeHandle.get(key) ?? []),
      output,
    ])
  }

  const staticAssets = new Map<string, PlannedStaticAssetPrerequisite>()
  const priorRequirements = new Map<string, PlannedPriorOutputRequirement>()
  const issues: FlowRunPlanningIssue[] = []
  const executionNodes: MaterializedExecutionNode[] = []

  for (const [level, levelNodeIds] of prepared.topologicalLevels.entries()) {
    for (const nodeId of levelNodeIds) {
      const node = nodesById.get(nodeId)!
      const selectedNode = selectedById.get(nodeId)!
      const model = getGenerationModel(
        String(node.data.modelId ?? ''),
        node.data.modelContractVersion,
      )!
      const operation = getGenerationOperation(model, node.data.operationId)!
      const outputHandle = getFlowNodeHandles(node, input.context)
        .find(handle => handle.direction === 'output')!
      const inputs: MaterializedFlowRunInput[] = []

      for (const edge of incomingByNodeId.get(nodeId) ?? []) {
        const sourceNode = nodesById.get(edge.sourceNodeId)!
        const sourceHandleId = edge.sourceHandle ?? ''
        const targetHandleId = edge.targetHandle ?? ''
        if (plannedExecutableIds.has(sourceNode.id)) {
          inputs.push({
            edgeId: edge.id,
            source: 'sameRunOutput',
            sourceHandleId,
            sourceNodeId: sourceNode.id,
            targetHandleId,
          })
          continue
        }

        let items: readonly FlowItem<FlowRuntimeValue>[] = []
        if (sourceNode.type === 'text') {
          const text = String(sourceNode.data.text ?? '')
          if (text.trim().length > 0)
            items = [createStaticTextItem({ nodeId: sourceNode.id, text })]
        }
        else if (sourceNode.type === 'asset' && sourceNode.assetId) {
          const mediaType = input.context.assetTypesById[sourceNode.assetId]
          if (mediaType) {
            items = [createStaticAssetItem({
              assetId: sourceNode.assetId,
              mediaType,
              nodeId: sourceNode.id,
            })]
            staticAssets.set(sourceNode.assetId, {
              assetId: sourceNode.assetId,
              mediaType,
              nodeId: sourceNode.id,
            })
          }
        }
        else if (isGenerationNodeType(sourceNode.type)) {
          const sourceHandle = getFlowNodeHandles(sourceNode, input.context)
            .find(handle =>
              handle.direction === 'output' && handle.id === sourceHandleId)
          const resolved = resolvePriorOutput({
            acceptedValueTypes: sourceHandle?.valueTypes ?? [],
            candidates: priorOutputsByNodeHandle.get(
              `${sourceNode.id}\u0000${sourceHandleId}`,
            ) ?? [],
            issues,
            nodeId: sourceNode.id,
            outputHandleId: sourceHandleId,
          })
          if (resolved) {
            items = resolved.items
            priorRequirements.set(resolved.generationJobId, {
              completedAt: resolved.completedAt,
              generationJobId: resolved.generationJobId,
              itemKeys: Object.freeze(resolved.items.map(item => item.key)),
              nodeId: resolved.nodeId,
              outputHandleId: resolved.outputHandleId,
            })
          }
          else {
            issues.push({
              code: 'missing_upstream_output',
              field: `nodes.${nodeId}.handles.${targetHandleId}`,
              nodeId,
              params: { sourceNodeId: sourceNode.id, suggestion: 'upstream' },
              slotId: targetHandleId,
            })
          }
        }

        inputs.push({
          edgeId: edge.id,
          items,
          source: 'captured',
          sourceHandleId,
          sourceNodeId: sourceNode.id,
          targetHandleId,
        })
      }

      executionNodes.push(Object.freeze({
        inclusionReason: selectedNode.inclusionReason,
        inputs: Object.freeze(inputs),
        level,
        model,
        node,
        nodeType: node.type as FlowNodeType,
        operationId: operation.id,
        outputCount: generationOutputCount(node),
        outputHandleId: outputHandle.id,
        outputValueType: outputHandle.valueTypes[0] ?? model.mediaType,
        settings: normalizedGenerationSettings(node),
      }))
    }
  }

  return {
    ok: true,
    value: Object.freeze({
      issues: Object.freeze(issues),
      nodes: Object.freeze(executionNodes),
      priorOutputRequirements: Object.freeze([...priorRequirements.values()]),
      staticAssetPrerequisites: Object.freeze([...staticAssets.values()]),
    }),
  }
}
