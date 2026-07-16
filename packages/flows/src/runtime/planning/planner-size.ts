/** Fixed-point canonical byte sizing for self-describing run plans. */

import type { FlowRunPlan } from './planner-contracts.js'
import { canonicalByteLength } from '../serialization/canonical-hash.js'

/** Resolves the self-referential canonical plan-byte count to a fixed point. */
export function fixedPointPlanBytes(plan: FlowRunPlan) {
  let planBytes = plan.summary.planBytes
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const candidate = {
      ...plan,
      summary: { ...plan.summary, planBytes },
    }
    const next = canonicalByteLength(candidate)
    if (next === planBytes)
      return { ...candidate, summary: { ...candidate.summary, planBytes: next } }
    planBytes = next
  }
  return {
    ...plan,
    summary: { ...plan.summary, planBytes },
  }
}
