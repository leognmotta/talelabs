import type { FlowRunPlanV1 } from './planner-contracts.js'
import { canonicalByteLength } from '../serialization/canonical-hash.js'

export function fixedPointPlanBytes(plan: FlowRunPlanV1) {
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
