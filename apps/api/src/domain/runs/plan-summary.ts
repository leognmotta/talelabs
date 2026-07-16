/** Planner-summary persistence and safe response projection. */

import type { JsonValue } from '@talelabs/db'
import type { FlowRunPlan } from '@talelabs/flows'

/** Projects an immutable planner summary into API persistence fields. */
export function summaryFromPlan(plan: FlowRunPlan & { planHash: string }) {
  return {
    flowId: plan.flowId,
    flowRevision: plan.flowRevision,
    planHash: plan.planHash,
    expectedOutputCount: plan.summary.expectedOutputCount,
    plannedExecutableCount: plan.summary.plannedExecutableCount,
    plannedItemCount: plan.summary.plannedItemCount,
    plannedJobCount: plan.summary.plannedJobCount,
    requestedExecutableCount: plan.summary.requestedExecutableCount,
    topologicalDepth: plan.summary.topologicalDepth,
  }
}

/** Extracts a safe plan summary from one persisted run snapshot. */
export function extractPlanSummary(run: { graphSnapshot: JsonValue }) {
  const snapshot = run.graphSnapshot as any
  const summary = snapshot?.plan?.summary ?? {}
  return {
    expectedOutputCount: Number(summary.expectedOutputCount ?? 0),
    plannedExecutableCount: Number(summary.plannedExecutableCount ?? 0),
    plannedItemCount: Number(summary.plannedItemCount ?? 0),
    plannedJobCount: Number(summary.plannedJobCount ?? 0),
  }
}
