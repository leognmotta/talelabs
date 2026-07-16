import { hashCanonicalValue } from './canonical-hash.js'
import { FLOW_RUN_HASH_DOMAINS } from './canonical-json.js'

export function hashFlowRunPlan(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.plan, value)
}

export function hashFlowRunRequest(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.request, value)
}

export function hashFlowRunSnapshot(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.snapshot, value)
}
