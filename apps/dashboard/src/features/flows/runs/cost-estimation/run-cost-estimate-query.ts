/** Canonical TanStack Query keys for one provider-cost estimate scope. */

import type { NormalizedFlowRunCommand } from '@talelabs/flows'

import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'

/** Builds the cache key shared by manifest seeding and individual consumers. */
export function runCostEstimateQueryKey(input: {
  /** Provider-neutral command whose estimate is cached. */
  command: NormalizedFlowRunCommand
  /** Debug-versus-live pricing policy. */
  executionMode: 'debug' | 'live'
  /** Current managed execution driver. */
  executionRuntime: 'browser' | 'managed'
  /** Flow whose saved scope was estimated. */
  flowId: string
  /** Tenant owning the Flow. */
  organizationId: string
  /** Cost-relevant graph and prior-result fingerprint. */
  scopeFingerprint: string
}) {
  return flowQueryKeys.runCostEstimate(input)
}
