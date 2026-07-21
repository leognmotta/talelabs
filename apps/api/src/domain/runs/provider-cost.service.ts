/** Provider-cost preparation, selection orchestration, and public summaries. */

import type { FlowRunPlan } from '@talelabs/flows'
import type {
  CatalogProviderBinding,
  CatalogProviderId,
} from '@talelabs/models-catalog'
import type {
  ProviderCostInputAsset,
  ProviderPricingSnapshot,
} from '@talelabs/providers/server'
import type { ProviderCostNodeRouting } from './provider-cost-routing.js'

import {
  getCatalogProviderBinding,
  getCatalogProviderBindings,
} from '@talelabs/models-catalog'
import {
  addProviderCostDecimals,
  loadProviderPricingSnapshot,
} from '@talelabs/providers/server'
import { plannedProviderCostNodes } from './provider-cost-plan.js'
import {
  resolveCachedProviderCostNodeRouting,
  resolveProviderCostNodeRouting,
  resolveProviderPriorityRouting,
} from './provider-cost-routing.js'

/** Public aggregate returned by run-plan preflight without provider identities. */
export type PublicRunCostEstimate
  = | {
    /** Exact decimal advisory provider cost in USD. */
    amountUsd: string
    /** Currency discriminator for UI formatting. */
    currency: 'USD'
    /** Number of planned jobs included in the amount. */
    estimatedJobCount: number
    /** Fully estimated preflight discriminator. */
    status: 'estimated'
    /** No jobs are omitted from a complete estimate. */
    unavailableJobCount: 0
  }
  | {
    /** Totals are withheld rather than displaying a misleading subtotal. */
    amountUsd: null
    /** Currency discriminator for UI explanation. */
    currency: 'USD'
    /** Number of jobs that could be estimated independently. */
    estimatedJobCount: number
    /** Partial preflight discriminator. */
    status: 'partial'
    /** Number of jobs whose provider cost could not be estimated. */
    unavailableJobCount: number
  }
  | {
    /** No subtotal is displayed when no job can be estimated. */
    amountUsd: null
    /** Currency discriminator for UI explanation. */
    currency: 'USD'
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
  /** Provider-neutral immutable Flow plan. */
  plan: FlowRunPlan
}): Map<string, CatalogProviderBinding[]> {
  return new Map(input.plan.executionNodes.map(node => [
    node.nodeId,
    getCatalogProviderBindings(node.modelId, node.operationId).filter(binding =>
      binding.executionRuntimes.includes(input.executionRuntime)
      && input.availableProviders.has(binding.provider),
    ),
  ]))
}

/** Resolves the quote candidates used consistently by preflight and admission. */
export function providerCostCandidateBindingsForMode(input: {
  /** Providers holding usable credentials for this request mode. */
  availableProviders: ReadonlySet<CatalogProviderId>
  /** Debug quotes use the preferred real binding without executing it. */
  executionMode: 'debug' | 'live'
  /** Runtime where a live provider request would execute. */
  executionRuntime: 'browser' | 'managed'
  /** Provider-neutral immutable Flow plan. */
  plan: FlowRunPlan
}): Map<string, CatalogProviderBinding[]> {
  if (input.executionMode === 'live')
    return providerCostCandidateBindings(input)
  return new Map(input.plan.executionNodes.map((node) => {
    const binding = getCatalogProviderBinding(node.modelId, node.operationId)
    return [node.nodeId, binding ? [binding] : []]
  }))
}

/** Loads mutable pricing for all distinct eligible candidate bindings. */
export async function prepareProviderCostPricing(input: {
  /** Candidate bindings grouped by planned node ID. */
  candidatesByNode: ReadonlyMap<string, readonly CatalogProviderBinding[]>
  /** Optional request cancellation signal. */
  signal?: AbortSignal
}): Promise<ProviderPricingSnapshot> {
  return loadProviderPricingSnapshot({
    bindings: [...input.candidatesByNode.values()].flat(),
    signal: input.signal,
  })
}

/** Resolves binding selection and cost quotes for every planned node. */
export function resolvePlanProviderCosts(input: {
  /** Locked or tenant-scoped Asset metadata used by formulas. */
  assetsById: ReadonlyMap<string, ProviderCostInputAsset>
  /** Candidate bindings grouped by planned node ID. */
  candidatesByNode: ReadonlyMap<string, readonly CatalogProviderBinding[]>
  /** Whether the selected funding source permits cost calculation. */
  costEstimationEnabled: boolean
  /** Whether complete cost estimates may override catalog priority. */
  costRoutingEnabled: boolean
  /** Provider-neutral immutable Flow plan. */
  plan: FlowRunPlan
  /** Request-scoped mutable pricing metadata. */
  pricing: ProviderPricingSnapshot
}): Map<string, ProviderCostNodeRouting> {
  if (!input.costEstimationEnabled) {
    return new Map(input.plan.executionNodes.flatMap((node) => {
      const route = resolveProviderPriorityRouting(
        input.candidatesByNode.get(node.nodeId) ?? [],
      )
      return route ? [[node.nodeId, route] as const] : []
    }))
  }
  const routes = new Map<string, ProviderCostNodeRouting>()
  for (const node of plannedProviderCostNodes({
    assetsById: input.assetsById,
    plan: input.plan,
  })) {
    const route = resolveProviderCostNodeRouting({
      costEstimationEnabled: input.costEstimationEnabled,
      costRoutingEnabled: input.costRoutingEnabled,
      eligibleBindings: input.candidatesByNode.get(node.nodeId) ?? [],
      node,
      pricing: input.pricing,
    })
    if (route)
      routes.set(node.nodeId, route)
  }
  return routes
}

/**
 * Resolves advisory preflight routes with per-job cache reuse. Equivalent jobs
 * share estimates across commands while unrelated node changes keep their keys.
 */
export async function resolveCachedPlanProviderCosts(input: {
  /** Tenant-scoped Asset metadata used by provider formulas. */
  assetsById: ReadonlyMap<string, ProviderCostInputAsset>
  /** Candidate bindings grouped by planned node ID. */
  candidatesByNode: ReadonlyMap<string, readonly CatalogProviderBinding[]>
  /** Whether complete estimates may override catalog priority. */
  costRoutingEnabled: boolean
  /** Provider-neutral immutable Flow plan. */
  plan: FlowRunPlan
}): Promise<Map<string, ProviderCostNodeRouting>> {
  const entries = await Promise.all(plannedProviderCostNodes({
    assetsById: input.assetsById,
    plan: input.plan,
  }).map(async (node) => {
    const route = await resolveCachedProviderCostNodeRouting({
      costEstimationEnabled: true,
      costRoutingEnabled: input.costRoutingEnabled,
      eligibleBindings: input.candidatesByNode.get(node.nodeId) ?? [],
      node,
    })
    return route ? [node.nodeId, route] as const : undefined
  }))
  return new Map(entries.filter(
    (entry): entry is readonly [string, ProviderCostNodeRouting] => Boolean(entry),
  ))
}

/** Projects selected per-job estimates onto one provider-neutral public total. */
export function publicRunCostEstimate(input: {
  /** Planned job count used to make unavailable work explicit. */
  plannedJobCount: number
  /** Resolved node routes whose selected per-job estimates are summarized. */
  routes: ReadonlyMap<string, ProviderCostNodeRouting>
}): PublicRunCostEstimate {
  const estimates = [...input.routes.values()]
    .flatMap(route => [...route.jobEstimates.values()])
  const amounts = estimates.flatMap(estimate =>
    estimate.status === 'estimated' ? [estimate.amountUsd] : [],
  )
  const estimatedJobCount = amounts.length
  const unavailableJobCount = Math.max(0, input.plannedJobCount - estimatedJobCount)
  if (unavailableJobCount === 0 && estimatedJobCount === input.plannedJobCount) {
    return {
      amountUsd: addProviderCostDecimals(amounts),
      currency: 'USD',
      estimatedJobCount,
      status: 'estimated',
      unavailableJobCount: 0,
    }
  }
  if (estimatedJobCount > 0) {
    return {
      amountUsd: null,
      currency: 'USD',
      estimatedJobCount,
      status: 'partial',
      unavailableJobCount,
    }
  }
  return {
    amountUsd: null,
    currency: 'USD',
    estimatedJobCount: 0,
    status: 'unavailable',
    unavailableJobCount,
  }
}
