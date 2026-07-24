/** Query-key hierarchy for durable run lists, active runs, and run details. */

import { organizationQueryKeys } from '../../../organizations/organization-query-keys'

function runScope(organizationId: null | string) {
  return [...organizationQueryKeys.scope(organizationId), 'runs'] as const
}

/** Prefix matching every observed run in the organization. */
export function flowRuns(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...runScope(organizationId), 'flow', flowId] as const
}

/** Prefix matching every paginated history presentation for one Flow. */
export function flowRunHistories(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowRuns(organizationId, flowId), 'history'] as const
}

/** Key for one cursor-paginated immutable run history owned by a Flow. */
export function flowRunHistory(
  organizationId: null | string,
  flowId: null | string,
  pageSize: number,
) {
  return [...flowRunHistories(organizationId, flowId), pageSize] as const
}

/** Prefix matching bounded live run-history presentations for one Flow. */
export function flowRunLiveHistories(
  organizationId: null | string,
  flowId: null | string,
) {
  return [...flowRunHistories(organizationId, flowId), 'live'] as const
}

/** Key for the newest bounded run page that may still contain active runs. */
export function flowRunLiveHistory(
  organizationId: null | string,
  flowId: null | string,
  pageSize: number,
) {
  return [...flowRunLiveHistories(organizationId, flowId), pageSize] as const
}

/** Key for immutable older pages anchored after one exact live-page cursor. */
export function flowRunArchiveHistory(
  organizationId: null | string,
  flowId: null | string,
  pageSize: number,
  anchorCursor: null | string,
) {
  return [
    ...flowRunHistories(organizationId, flowId),
    'archive',
    pageSize,
    anchorCursor,
  ] as const
}

/** Prefix matching direct run histories across every Create session. */
export function createRunHistoryScope(
  organizationId: null | string,
) {
  return [...runScope(organizationId), 'create', 'history'] as const
}

/** Prefix matching one durable Create session's direct run history. */
export function createRunHistories(
  organizationId: null | string,
  createSessionId: null | string,
) {
  return [
    ...createRunHistoryScope(organizationId),
    createSessionId,
  ] as const
}

/** Key for Create's newest bounded page, which may contain active runs. */
export function createRunLiveHistory(
  organizationId: null | string,
  createSessionId: null | string,
  pageSize: number,
) {
  return [
    ...createRunHistories(organizationId, createSessionId),
    'live',
    pageSize,
  ] as const
}

/** Prefix matching every refreshable Create live-history presentation. */
export function createRunLiveHistories(
  organizationId: null | string,
  createSessionId?: null | string,
) {
  return createSessionId
    ? [
        ...createRunHistories(organizationId, createSessionId),
        'live',
      ] as const
    : createRunHistoryScope(organizationId)
}

/** Key for bounded immutable Create pages after one live-page cursor. */
export function createRunArchiveHistory(
  organizationId: null | string,
  createSessionId: null | string,
  pageSize: number,
  anchorCursor: null | string,
) {
  return [
    ...createRunHistories(organizationId, createSessionId),
    'archive',
    pageSize,
    anchorCursor,
  ] as const
}

/** Key for one canonical direct-request provider-cost estimate. */
export function createRunCostEstimate(input: {
  /** Paid-boundary policy used by the direct request. */
  executionMode: 'debug' | 'live'
  /** Tenant owning the referenced Assets. */
  organizationId: null | string
  /** Canonical direct request fingerprint. */
  requestFingerprint: string
}) {
  return [
    ...runScope(input.organizationId),
    'create',
    'cost-estimate',
    input.executionMode,
    input.requestFingerprint,
  ] as const
}

/** Key for active run ids used to recover realtime subscriptions after reload. */
export function flowActiveRuns(organizationId: null | string) {
  return [...runScope(organizationId), 'active'] as const
}

/** Key for active browser-driver runs discovered from PostgreSQL. */
export function flowActiveBrowserRuns(
  organizationId: null | string,
  userId: null | string,
) {
  return [
    ...runScope(organizationId),
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
  return [...runScope(organizationId), runId, 'detail'] as const
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
