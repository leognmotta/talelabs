/**
 * Canonical immutable Flow run plan assembly and hashing.
 *
 * This final stage owns deterministic snapshot ordering, bounded byte sizing,
 * and the plan hash persisted by run admission.
 */

import type { FlowGraphNode } from '../../graph/types.js'
import type { FlowRunExecutionMaterialization } from './execution-materialization.js'
import type { ExpandedFlowRunJobs } from './job-expansion.js'
import type {
  FlowRunPlan,
  FlowRunPlanningResult,
} from './planner-contracts.js'
import type { PreparedSelectedGraph } from './selected-graph-preparation.js'

import { compareStableStrings } from '../../graph/ordering/stable.js'
import { hashFlowRunPlan } from '../serialization/plan-hashes.js'
import {
  FLOW_RUN_PLAN_VERSION,
  FLOW_RUN_PLANNER_VERSION,
} from '../snapshots/contracts.js'
import { executableFlowNodeData } from './planner-node-data.js'
import { flowRunPlanningFailure } from './planner-result.js'
import { fixedPointPlanBytes } from './planner-size.js'

/** Assembles, bounds, and hashes the final immutable Flow run plan. */
export function assembleFlowRunPlan(input: {
  expanded: ExpandedFlowRunJobs
  materialization: FlowRunExecutionMaterialization
  prepared: PreparedSelectedGraph
}): FlowRunPlanningResult {
  const { expanded, materialization, prepared } = input
  const topologicalOrder = prepared.topologicalLevels.flat()
  const captureOrder = new Map(topologicalOrder.map((nodeId, index) => [
    nodeId,
    index,
  ]))
  const capturedNodes = prepared.selection.capturedNodeIds
    .map(nodeId => prepared.nodesById.get(nodeId))
    .filter((node): node is FlowGraphNode => Boolean(node))
    .toSorted((left, right) => {
      const leftOrder = captureOrder.get(left.id)
      const rightOrder = captureOrder.get(right.id)
      if (leftOrder !== undefined || rightOrder !== undefined) {
        return (leftOrder ?? Number.MAX_SAFE_INTEGER)
          - (rightOrder ?? Number.MAX_SAFE_INTEGER)
      }
      return compareStableStrings(left.id, right.id)
    })
    .map(node => ({
      assetId: node.assetId,
      data: executableFlowNodeData(node.data),
      id: node.id,
      schemaVersion: node.schemaVersion,
      type: node.type,
    }))

  const planWithoutHash: FlowRunPlan = {
    capturedEdges: prepared.capturedEdges.map((edge, order) => ({
      id: edge.id,
      order,
      sourceHandle: edge.sourceHandle,
      sourceNodeId: edge.sourceNodeId,
      targetHandle: edge.targetHandle,
      targetNodeId: edge.targetNodeId,
    })),
    capturedNodes,
    command: prepared.command,
    executionNodes: expanded.executionNodes,
    flowId: prepared.input.flow.id,
    flowRevision: prepared.input.flow.revision,
    planVersion: FLOW_RUN_PLAN_VERSION,
    plannerVersion: FLOW_RUN_PLANNER_VERSION,
    prerequisites: {
      priorOutputs: [...materialization.priorOutputRequirements]
        .toSorted((left, right) =>
          compareStableStrings(left.nodeId, right.nodeId)
          || compareStableStrings(left.outputHandleId, right.outputHandleId)
          || compareStableStrings(left.generationJobId, right.generationJobId)),
      staticAssets: [...materialization.staticAssetPrerequisites]
        .toSorted((left, right) =>
          compareStableStrings(left.assetId, right.assetId)
          || compareStableStrings(left.nodeId, right.nodeId)),
    },
    summary: {
      expectedOutputCount: expanded.expectedOutputCount,
      planBytes: 0,
      plannedExecutableCount: expanded.executionNodes.length,
      plannedItemCount: expanded.plannedItemCount,
      plannedJobCount: expanded.plannedJobCount,
      requestedExecutableCount: prepared.selection.requestedExecutableCount,
      topologicalDepth: prepared.topologicalLevels.length,
    },
    topologicalLevels: prepared.topologicalLevels,
  }
  const canonicalPlan = fixedPointPlanBytes(planWithoutHash)
  if (canonicalPlan.summary.planBytes > prepared.limits.snapshotBytes) {
    return flowRunPlanningFailure([{
      code: 'run_snapshot_bytes_limit',
      field: 'plan',
      params: { maximum: prepared.limits.snapshotBytes },
    }])
  }

  return {
    ok: true,
    plan: Object.freeze({
      ...canonicalPlan,
      planHash: hashFlowRunPlan(canonicalPlan),
    }),
  }
}
