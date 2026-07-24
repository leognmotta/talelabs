/** Pure cost-first selection of one eligible binding per planned node. */

import type {
  FlowRunSnapshotProviderSelection,
} from '@talelabs/flows'
import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type {
  DeterministicProviderCostEstimate,
  ProviderCostEstimate,
  ProviderPricingSnapshot,
} from '@talelabs/providers/server'
import type { PlannedProviderCostNode } from './provider-cost-plan.js'

import {
  aggregateProviderCostEstimates,
  compareProviderCostDecimals,
  estimateProviderCost,
} from '@talelabs/providers/server'

/** Selected route, aggregate quote, and per-job quote results for one node. */
export interface ProviderCostNodeRouting {
  /** Exact binding captured in the immutable run snapshot. */
  binding: CatalogProviderBinding
  /** Complete node estimate when every job was deterministic. */
  estimate: ProviderCostEstimate
  /** Per-job estimates keyed by stable planner job hash. */
  jobEstimates: ReadonlyMap<string, ProviderCostEstimate>
  /** Private selection explanation captured with the binding. */
  selection: FlowRunSnapshotProviderSelection
}

interface CandidateEstimate {
  binding: CatalogProviderBinding
  estimate: ProviderCostEstimate
  jobEstimates: ReadonlyMap<string, ProviderCostEstimate>
}

/** Selects the first eligible binding without constructing or evaluating quotes. */
export function resolveProviderPriorityRouting(
  eligibleBindings: readonly CatalogProviderBinding[],
): ProviderCostNodeRouting | undefined {
  const binding = eligibleBindings[0]
  if (!binding)
    return undefined
  return {
    binding,
    estimate: {
      reason: 'cost_estimation_disabled',
      status: 'unavailable',
    },
    jobEstimates: new Map(),
    selection: {
      eligibleCandidateCount: eligibleBindings.length,
      estimatedCandidateCount: 0,
      strategy: 'priority',
    },
  }
}

function estimateCandidate(input: {
  binding: CatalogProviderBinding
  node: PlannedProviderCostNode
  pricing: ProviderPricingSnapshot
}): CandidateEstimate {
  const jobEstimates = new Map(input.node.jobs.map(job => [
    job.jobKey,
    estimateProviderCost({
      pricing: input.pricing,
      request: { ...job.request, binding: input.binding },
    }),
  ]))
  return {
    binding: input.binding,
    estimate: aggregateProviderCostEstimates([...jobEstimates.values()]),
    jobEstimates,
  }
}

function selectedCandidateRouting(input: {
  candidates: readonly CandidateEstimate[]
  costRoutingEnabled: boolean
}): ProviderCostNodeRouting {
  const estimable = input.candidates.filter((candidate): candidate is CandidateEstimate & {
    estimate: DeterministicProviderCostEstimate
  } => candidate.estimate.status === 'estimated')
  const compareByCost = input.costRoutingEnabled
    && input.candidates.length > 1
    && estimable.length === input.candidates.length
  const selected = compareByCost
    ? estimable.reduce((cheapest, candidate) =>
        compareProviderCostDecimals(
          candidate.estimate.amountUsd,
          cheapest.estimate.amountUsd,
        ) < 0
          ? candidate
          : cheapest,
      )
    : input.candidates[0]!
  return {
    binding: selected.binding,
    estimate: selected.estimate,
    jobEstimates: selected.jobEstimates,
    selection: {
      eligibleCandidateCount: input.candidates.length,
      estimatedCandidateCount: estimable.length,
      strategy: compareByCost
        ? 'estimated_cost'
        : input.costRoutingEnabled && input.candidates.length > 1
          ? 'priority_fallback'
          : 'priority',
    },
  }
}

/**
 * Selects by complete deterministic cost only for Credits-funded live routing.
 * Missing pricing for any eligible candidate falls back to catalog priority for
 * the entire set; browser BYOK and debug callers always retain priority order.
 */
export function resolveProviderCostNodeRouting(input: {
  /** Whether this funding source permits provider-cost calculation. */
  costEstimationEnabled: boolean
  /** Whether complete estimates may override catalog priority. */
  costRoutingEnabled: boolean
  /** Runtime- and credential-eligible bindings in catalog priority order. */
  eligibleBindings: readonly CatalogProviderBinding[]
  /** Planned step requests evaluated identically for every candidate. */
  node: PlannedProviderCostNode
  /** Request-scoped mutable pricing metadata. */
  pricing: ProviderPricingSnapshot
}): ProviderCostNodeRouting | undefined {
  if (input.eligibleBindings.length === 0)
    return undefined
  if (!input.costEstimationEnabled)
    return resolveProviderPriorityRouting(input.eligibleBindings)
  const candidates = input.eligibleBindings.map(binding => estimateCandidate({
    binding,
    node: input.node,
    pricing: input.pricing,
  }))
  return selectedCandidateRouting({
    candidates,
    costRoutingEnabled: input.costRoutingEnabled,
  })
}
