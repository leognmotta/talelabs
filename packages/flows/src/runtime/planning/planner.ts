/**
 * Public orchestration pipeline for deterministic Flow run planning.
 *
 * Each stage owns one typed transformation: selected graph preparation,
 * execution materialization, job expansion, and final plan assembly.
 */

import type {
  FlowRunPlannerInput,
  FlowRunPlanningResult,
} from './planner-contracts.js'

import { materializeFlowRunExecution } from './execution-materialization.js'
import { expandFlowRunJobs } from './job-expansion.js'
import { assembleFlowRunPlan } from './plan-assembly.js'
import { flowRunPlanningFailure } from './planner-result.js'
import { prepareSelectedFlowRunGraph } from './selected-graph-preparation.js'

/** Plans one immutable, bounded Flow execution snapshot. */
export function planFlowRun(input: FlowRunPlannerInput): FlowRunPlanningResult {
  const selectedGraph = prepareSelectedFlowRunGraph(input)
  if (!selectedGraph.ok)
    return flowRunPlanningFailure(selectedGraph.issues)

  const materialization = materializeFlowRunExecution(selectedGraph.value)
  if (!materialization.ok)
    return flowRunPlanningFailure(materialization.issues)

  const expandedJobs = expandFlowRunJobs({
    limits: selectedGraph.value.limits,
    materialization: materialization.value,
  })
  if (!expandedJobs.ok)
    return flowRunPlanningFailure(expandedJobs.issues)

  return assembleFlowRunPlan({
    expanded: expandedJobs.value,
    materialization: materialization.value,
    prepared: selectedGraph.value,
  })
}
