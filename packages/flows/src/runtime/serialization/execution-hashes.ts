import { hashCanonicalValue } from './canonical-hash.js'
import { FLOW_RUN_HASH_DOMAINS } from './canonical-json.js'

export function hashFlowRunItem(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.item, value)
}

export function hashFlowRunJob(value: unknown) {
  return hashCanonicalValue(FLOW_RUN_HASH_DOMAINS.job, value)
}
