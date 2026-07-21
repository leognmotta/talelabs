/** Server-authoritative scope-cached cost manifests for canvas run controls. */

import type { PublicRunCostEstimate } from './provider-cost.service.js'

import {
  createCacheKey,
  getOrSetCachedValue,
  providerCostCache,
} from '@talelabs/cache'
import {
  FLOW_RUN_LIMITS,
  hashCanonicalValue,
  isGenerationNodeType,
} from '@talelabs/flows'
import { logRunEngine } from './logging.js'
import {
  loadFlowRunPlanningSource,
  preflightLoadedFlowRuns,
} from './planning.service.js'
import { loadProviderCostInputAssets } from './provider-cost-assets.js'
import { publicRunCostEstimate } from './provider-cost.service.js'

const PROVIDER_COST_MANIFEST_CACHE_TTL_MS = 5 * 60_000
const PROVIDER_COST_MANIFEST_NEGATIVE_CACHE_TTL_MS = 15_000

/** One runnable node's isolated preflight cost within a graph manifest. */
export interface FlowRunCostManifestNode {
  /** Advisory provider cost for running only this node. */
  costEstimate: PublicRunCostEstimate
  /** Stable saved Flow node identity. */
  nodeId: string
}

/** Graph-level cost response reused by every visible canvas run control. */
export interface FlowRunCostManifest {
  /** Advisory provider cost for every currently runnable node, omitted if empty or unrequested. */
  allCostEstimate?: PublicRunCostEstimate
  /** Flow identity whose saved revision was planned. */
  flowId: string
  /** Exact saved revision used by every estimate in this response. */
  flowRevision: number
  /** Isolated estimates for runnable generation nodes only. */
  nodes: FlowRunCostManifestNode[]
}

/** Inputs selecting one bounded managed Credits manifest request. */
export interface FlowRunCostManifestInput {
  /** Debug versus live binding and pricing behavior. */
  executionMode?: 'debug' | 'live'
  /** Managed runtime required by Credits-funded execution. */
  executionRuntime?: 'browser' | 'managed'
  /** Saved revision the browser has fully synchronized. */
  expectedFlowRevision: number
  /** Flow whose runnable generation nodes should be estimated. */
  flowId: string
  /** Credits discriminator preventing accidental BYOK estimation. */
  fundingSource: 'credits'
  /** Tenant owning the Flow and every referenced Asset. */
  organizationId: string
  /** Whether the whole-Flow estimate is needed in this response. */
  includeAll: boolean
  /** Direct-node estimates missing from the browser's current query cache. */
  nodeIds: readonly string[]
}

function planningSourceHash(
  source: Awaited<ReturnType<typeof loadFlowRunPlanningSource>>,
  assetsById: ReadonlyMap<string, unknown>,
): string {
  const nodes = source.flow.nodes.map((node) => {
    const { locked: _locked, ...data } = node.data
    return {
      assetId: node.assetId,
      data,
      id: node.id,
      schemaVersion: node.schemaVersion,
      type: node.type,
    }
  })
  return hashCanonicalValue('talelabs:provider-cost-planning-source:v1', {
    assets: [...assetsById.entries()].toSorted(([left], [right]) => (
      left.localeCompare(right)
    )),
    context: source.context,
    edges: source.flow.edges,
    nodes,
    priorOutputs: source.priorOutputs,
  })
}

function planningSourceAssetIds(
  source: Awaited<ReturnType<typeof loadFlowRunPlanningSource>>,
): string[] {
  const assetIds = new Set(Object.keys(source.context.assetTypesById))
  for (const priorOutput of source.priorOutputs) {
    for (const item of priorOutput.items) {
      if (item.value.kind === 'text')
        continue
      for (const asset of item.value.assets) {
        if ('assetId' in asset)
          assetIds.add(asset.assetId)
      }
    }
  }
  return [...assetIds].toSorted()
}

function scopeCacheKey(input: {
  command: { mode: 'all' } | { mode: 'node', targetNodeId: string }
  executionMode: 'debug' | 'live'
  executionRuntime: 'browser' | 'managed'
  flowId: string
  organizationId: string
  sourceHash: string
}): string {
  return createCacheKey('provider-cost-scope:v2', [
    input.organizationId,
    input.flowId,
    input.executionMode,
    input.executionRuntime,
    input.sourceHash,
    input.command.mode,
    input.command.mode === 'node' ? input.command.targetNodeId : '',
  ])
}

function scopeCacheTtl(estimate: PublicRunCostEstimate): number {
  return estimate.status === 'estimated'
    ? PROVIDER_COST_MANIFEST_CACHE_TTL_MS
    : PROVIDER_COST_MANIFEST_NEGATIVE_CACHE_TTL_MS
}

function manifestSingleflightKey(input: FlowRunCostManifestInput): string {
  return createCacheKey('provider-cost-manifest-flight:v1', [
    input.organizationId,
    input.flowId,
    input.expectedFlowRevision,
    input.executionMode ?? 'live',
    input.executionRuntime ?? 'managed',
    input.includeAll,
    hashCanonicalValue(
      'talelabs:provider-cost-manifest-request-scopes:v1',
      [...new Set(input.nodeIds)].toSorted(),
    ),
  ])
}

async function calculateFlowRunCostManifest(
  input: FlowRunCostManifestInput,
): Promise<FlowRunCostManifest> {
  const startedAt = performance.now()
  const source = await loadFlowRunPlanningSource({
    expectedFlowRevision: input.expectedFlowRevision,
    flowId: input.flowId,
    organizationId: input.organizationId,
  })
  const generationNodeIds = source.flow.nodes
    .filter(node => isGenerationNodeType(node.type))
    .map(node => node.id)
    .toSorted()
  const requestedNodeIds = new Set(input.nodeIds)
  const nodeIds = generationNodeIds.filter(nodeId => requestedNodeIds.has(nodeId))
  const includeRunnableAll = input.includeAll
    && generationNodeIds.length <= FLOW_RUN_LIMITS.executableNodes
  const commands: Array<
    | {
      expectedFlowRevision: number
      mode: 'all'
    }
    | {
      expectedFlowRevision: number
      mode: 'node'
      targetNodeId: string
    }
  > = [
    ...(includeRunnableAll
      ? [{
          expectedFlowRevision: input.expectedFlowRevision,
          mode: 'all' as const,
        }]
      : []),
    ...nodeIds.map(nodeId => ({
      expectedFlowRevision: input.expectedFlowRevision,
      mode: 'node' as const,
      targetNodeId: nodeId,
    })),
  ]
  const executionMode = input.executionMode ?? 'live'
  const executionRuntime = input.executionRuntime ?? 'managed'
  const assetsById = await loadProviderCostInputAssets({
    assetIds: planningSourceAssetIds(source),
    organizationId: input.organizationId,
  })
  const sourceHash = planningSourceHash(source, assetsById)
  const entries = commands.map(command => ({
    command,
    key: scopeCacheKey({
      command,
      executionMode,
      executionRuntime,
      flowId: input.flowId,
      organizationId: input.organizationId,
      sourceHash,
    }),
  }))
  const results = await Promise.all(entries.map(entry => (
    providerCostCache.get<PublicRunCostEstimate>(entry.key)
  )))
  const missingIndexes = results.flatMap((result, index) => (
    result ? [] : [index]
  ))
  if (missingIndexes.length > 0) {
    const calculated = await preflightLoadedFlowRuns({
      assetsById,
      commands: missingIndexes.map(index => entries[index]!.command),
      executionMode,
      executionRuntime,
      fundingSource: input.fundingSource,
      organizationId: input.organizationId,
      source,
    })
    await Promise.all(calculated.map(async (result, calculatedIndex) => {
      const resultIndex = missingIndexes[calculatedIndex]!
      results[resultIndex] = result.costEstimate
      await providerCostCache.set(
        entries[resultIndex]!.key,
        result.costEstimate,
        {
          ttlMs: scopeCacheTtl(result.costEstimate),
        },
      )
    }))
  }
  const allResult = includeRunnableAll ? results[0] : undefined
  const nodeResults = includeRunnableAll ? results.slice(1) : results
  const manifest = {
    ...(input.includeAll
      ? {
          allCostEstimate: allResult ?? publicRunCostEstimate({
            plannedJobCount: 0,
            routes: new Map(),
          }),
        }
      : {}),
    flowId: input.flowId,
    flowRevision: input.expectedFlowRevision,
    nodes: nodeResults.flatMap((result, index) => result
      ? [{
          costEstimate: result,
          nodeId: nodeIds[index]!,
        }]
      : []),
  } satisfies FlowRunCostManifest
  logRunEngine('info', 'flow_run.cost_manifest.calculated', {
    cacheHitScopeCount: entries.length - missingIndexes.length,
    calculatedScopeCount: missingIndexes.length,
    durationMs: Math.round(performance.now() - startedAt),
    flowId: input.flowId,
    flowRevision: input.expectedFlowRevision,
    requestedNodeEstimateCount: nodeIds.length,
    nodeEstimateCount: manifest.nodes.length,
    organizationId: input.organizationId,
    requestedScopeCount: entries.length,
  })
  return manifest
}

/** Loads one authoritative source and reuses independently cached scope results. */
export function getFlowRunCostManifest(
  input: FlowRunCostManifestInput,
): Promise<FlowRunCostManifest> {
  return getOrSetCachedValue({
    cache: providerCostCache,
    key: manifestSingleflightKey(input),
    load: () => calculateFlowRunCostManifest(input),
    shouldCache: () => false,
    ttlMs: PROVIDER_COST_MANIFEST_NEGATIVE_CACHE_TTL_MS,
  })
}
