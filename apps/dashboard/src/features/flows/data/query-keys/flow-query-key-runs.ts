/** Query-key hierarchy for Flow run lists, active runs, and run details. */

import { flowScope } from './flow-query-key-scope'

/** Prefix matching every observed run in the organization. */
export function flowRuns(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowScope(organizationId), 'runs', flowId] as const
}

/** Key for active run ids used to recover realtime subscriptions after reload. */
export function flowActiveRuns(organizationId: null | string) {
  return [...flowScope(organizationId), 'runs', 'active'] as const
}

/** Key for active browser-driver runs discovered from PostgreSQL. */
export function flowActiveBrowserRuns(
  organizationId: null | string,
  userId: null | string,
) {
  return [
    ...flowScope(organizationId),
    'runs',
    'active',
    'browser',
    userId,
  ] as const
}

/** Key for one durable run detail and its jobs. */
export function flowRun(
  organizationId: null | string,
  runId: null | string,
) {
  return [...flowScope(organizationId), 'run', runId, 'detail'] as const
}

/** Key for one cost-relevant Flow scope and mode-aware preflight command. */
export function flowRunCostEstimate(input: {
  /** Provider-neutral run command included in the preflight request. */
  command: object
  /** Run mode controlling debug-versus-live cost explanation. */
  executionMode: 'debug' | 'live'
  /** Driver used by the current Credits execution path. */
  executionRuntime: 'browser' | 'managed'
  /** Flow whose saved graph is being estimated. */
  flowId: null | string
  /** Tenant owning the Flow. */
  organizationId: null | string
  /** Hash of only the graph and reference facts captured by this command. */
  scopeFingerprint: string
}) {
  return [
    ...flowRuns(input.organizationId, input.flowId),
    'cost-estimate',
    input.scopeFingerprint,
    input.executionMode,
    input.executionRuntime,
    input.command,
  ] as const
}

/** Key for one batched request containing only currently missing cost scopes. */
export function flowRunCostManifest(input: {
  /** Browser cost-context partition for graph references and prior results. */
  estimateContextHash: string
  /** Run mode controlling debug-versus-live cost explanation. */
  executionMode: 'debug' | 'live'
  /** Driver used by the current Credits execution path. */
  executionRuntime: 'browser' | 'managed'
  /** Saved Flow revision planned by the server. */
  flowRevision: number
  /** Flow whose missing scopes are requested. */
  flowId: null | string
  /** Whether this batch includes the whole-Flow estimate. */
  includeAll: boolean
  /** Direct-node estimates absent from the browser cache. */
  nodeIds: readonly string[]
  /** Tenant owning the Flow. */
  organizationId: null | string
}) {
  return [
    ...flowRuns(input.organizationId, input.flowId),
    'cost-manifest',
    input.flowRevision,
    input.executionMode,
    input.executionRuntime,
    input.estimateContextHash,
    input.includeAll,
    input.nodeIds,
  ] as const
}
