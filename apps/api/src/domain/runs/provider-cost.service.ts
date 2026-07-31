/** Provider-cost preparation, selection orchestration, and public summaries. */

import type { ExecutionPlan } from '@talelabs/flows'
import type {
  CatalogProviderBinding,
  CatalogProviderId,
} from '@talelabs/models-catalog'
import type {
  ProviderCostInputAsset,
  ProviderPricingSnapshot,
} from '@talelabs/providers/server'
import type { ProviderCostNodeRouting } from './provider-cost-routing.js'

import { quoteProviderCredits } from '@talelabs/billing'
import {
  getCatalogProviderBinding,
  getCatalogProviderBindings,
} from '@talelabs/models-catalog'
import { plannedProviderCostNodes } from './provider-cost-plan.js'
import {
  resolveProviderCostNodeRouting,
  resolveProviderPriorityRouting,
} from './provider-cost-routing.js'

/** Public aggregate returned by run-plan preflight without provider identities. */
export type PublicRunCostEstimate
  = | {
    /** Whole TaleLabs credits reserved when the run is admitted unchanged. */
    estimatedCredits: number
    /** Number of planned jobs included in the amount. */
    estimatedJobCount: number
    /** Fully estimated preflight discriminator. */
    status: 'estimated'
    /** No jobs are omitted from a complete estimate. */
    unavailableJobCount: 0
  }
  | {
    /** Totals are withheld rather than displaying a misleading subtotal. */
    estimatedCredits: null
    /** Number of jobs that could be estimated independently. */
    estimatedJobCount: number
    /** Partial preflight discriminator. */
    status: 'partial'
    /** Number of jobs whose provider cost could not be estimated. */
    unavailableJobCount: number
  }
  | {
    /** No total is displayed when no job can be estimated. */
    estimatedCredits: null
    /** No planned jobs were independently estimable. */
    estimatedJobCount: 0
    /** Fully unavailable preflight discriminator. */
    status: 'unavailable'
    /** Number of jobs whose provider cost could not be estimated. */
    unavailableJobCount: number
  }

/** Resolves runtime-eligible candidates in stable catalog priority order. */
export function providerCostCandidateBindings(input: {
  /** Providers holding usable credentials for this request mode. */
  availableProviders: ReadonlySet<CatalogProviderId>
  /** Runtime where the eventual provider request would execute. */
  executionRuntime: 'browser' | 'managed'
  /** Provider-neutral immutable execution plan. */
  plan: ExecutionPlan
}): Map<string, CatalogProviderBinding[]> {
  return new Map(input.plan.steps.map(step => [
    step.stepId,
    getCatalogProviderBindings(step.modelId, step.operationId).filter(binding =>
      binding.executionRuntimes.includes(input.executionRuntime)
      && input.availableProviders.has(binding.provider),
    ),
  ]))
}

/** Resolves the quote candidates used consistently by preflight and admission. */
export function providerCostCandidateBindingsForMode(input: {
  /** Providers holding usable credentials for this request mode. */
  availableProviders: ReadonlySet<CatalogProviderId>
  /** Debug uses live managed candidates but never executes their adapters. */
  executionMode: 'debug' | 'live'
  /** Runtime where a live provider request would execute. */
  executionRuntime: 'browser' | 'managed'
  /** Provider-neutral immutable execution plan. */
  plan: ExecutionPlan
}): Map<string, CatalogProviderBinding[]> {
  if (input.executionMode === 'live')
    return providerCostCandidateBindings(input)
  if (input.executionRuntime === 'managed') {
    const liveCandidates = providerCostCandidateBindings(input)
    return new Map(input.plan.steps.map((step) => {
      const candidates = liveCandidates.get(step.stepId) ?? []
      const fallback = getCatalogProviderBinding(
        step.modelId,
        step.operationId,
      )
      return [
        step.stepId,
        candidates.length > 0
          ? candidates
          : fallback ? [fallback] : [],
      ]
    }))
  }
  return new Map(input.plan.steps.map((step) => {
    const binding = getCatalogProviderBinding(step.modelId, step.operationId)
    return [step.stepId, binding ? [binding] : []]
  }))
}

/** Resolves binding selection and cost quotes for every planned node. */
export function resolvePlanProviderCosts(input: {
  /** Locked or tenant-scoped Asset metadata used by formulas. */
  assetsById: ReadonlyMap<string, ProviderCostInputAsset>
  /** Candidate bindings grouped by planned step ID. */
  candidatesByNode: ReadonlyMap<string, readonly CatalogProviderBinding[]>
  /** Whether the selected funding source permits cost calculation. */
  costEstimationEnabled: boolean
  /** Whether complete cost estimates may override catalog priority. */
  costRoutingEnabled: boolean
  /** Provider-neutral immutable execution plan. */
  plan: ExecutionPlan
  /** Request-scoped mutable pricing metadata. */
  pricing: ProviderPricingSnapshot
}): Map<string, ProviderCostNodeRouting> {
  if (!input.costEstimationEnabled) {
    return new Map(input.plan.steps.flatMap((step) => {
      const route = resolveProviderPriorityRouting(
        input.candidatesByNode.get(step.stepId) ?? [],
      )
      return route ? [[step.stepId, route] as const] : []
    }))
  }
  const routes = new Map<string, ProviderCostNodeRouting>()
  for (const step of plannedProviderCostNodes({
    assetsById: input.assetsById,
    plan: input.plan,
  })) {
    const route = resolveProviderCostNodeRouting({
      costEstimationEnabled: input.costEstimationEnabled,
      costRoutingEnabled: input.costRoutingEnabled,
      eligibleBindings: input.candidatesByNode.get(step.stepId) ?? [],
      node: step,
      pricing: input.pricing,
    })
    if (route)
      routes.set(step.stepId, route)
  }
  return routes
}

/** Projects selected per-job estimates onto one provider-neutral public total. */
export function publicRunCostEstimate(input: {
  /** Planned job count used to make unavailable work explicit. */
  plannedJobCount: number
  /** Resolved node routes whose selected per-job estimates are summarized. */
  routes: ReadonlyMap<string, ProviderCostNodeRouting>
}): PublicRunCostEstimate {
  const estimates = [...input.routes.values()].flatMap(route =>
    [...route.jobEstimates.values()].flatMap(estimate =>
      estimate.status === 'estimated'
        ? [{
            amountUsd: estimate.amountUsd,
            credits: quoteProviderCredits({
              provider: route.binding.provider,
              rawProviderCostUsd: estimate.amountUsd,
            }).credits,
          }]
        : []))
  const estimatedJobCount = estimates.length
  const unavailableJobCount = Math.max(0, input.plannedJobCount - estimatedJobCount)
  if (unavailableJobCount === 0 && estimatedJobCount === input.plannedJobCount) {
    return {
      estimatedCredits: estimates.reduce(
        (total, estimate) => total + estimate.credits,
        0,
      ),
      estimatedJobCount,
      status: 'estimated',
      unavailableJobCount: 0,
    }
  }
  if (estimatedJobCount > 0) {
    return {
      estimatedCredits: null,
      estimatedJobCount,
      status: 'partial',
      unavailableJobCount,
    }
  }
  return {
    estimatedCredits: null,
    estimatedJobCount: 0,
    status: 'unavailable',
    unavailableJobCount,
  }
}
