/** Ephemeral batched transport that seeds only per-scope cost-estimate queries. */

import type { RunCostEstimate } from '@talelabs/sdk'
import type { QueryKey } from '@tanstack/react-query'

import { ApiError, postFlowsIdRunCostEstimates } from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'

const ESTIMATE_REQUEST_RETRY_BASE_MS = 1_000
const ESTIMATE_REQUEST_RETRY_LIMIT = 2

/** One direct-node destination in the browser's authoritative scope cache. */
export interface RunCostEstimateManifestNodeScope {
  /** Saved Flow node whose direct run is being estimated. */
  nodeId: string
  /** Full tenant-, Flow-, runtime-, mode-, command-, and fingerprint-aware key. */
  queryKey: QueryKey
}

/** Transient state for the currently requested manifest batch. */
export interface RunCostEstimateManifestRequestState {
  /** Exact coordinator request identity that produced this state. */
  key: string
  /** Network lifecycle used only to sequence batches and delayed recovery. */
  status: 'error' | 'fetching' | 'idle' | 'success'
}

/** Completeness marker used by the bounded incomplete-estimate recovery hook. */
export interface RunCostEstimateRecoveryScope {
  /** Whether this scope received a complete deterministic estimate. */
  complete: boolean
  /** Batch-local scope identity such as `all` or `node:<id>`. */
  id: string
}

interface ManifestTransportRequest {
  allQueryKey?: QueryKey
  executionMode: 'debug' | 'live'
  executionRuntime: 'browser' | 'managed'
  expectedFlowRevision: number
  flowId: string
  includeAll: boolean
  nodeScopes: readonly RunCostEstimateManifestNodeScope[]
  organizationId: string
  requestKey: string
  signal: AbortSignal
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function retryableEstimateRequestError(error: unknown): boolean {
  return !isAbortError(error) && (!(error instanceof ApiError)
    || error.status === 429
    || error.status >= 500)
}

function isCompleteEstimate(
  estimate: RunCostEstimate | undefined,
): estimate is Extract<RunCostEstimate, { status: 'estimated' }> {
  return estimate?.status === 'estimated'
}

function unavailableEstimate(): RunCostEstimate {
  return {
    amountUsd: null,
    currency: 'USD',
    estimatedJobCount: 0,
    status: 'unavailable',
    unavailableJobCount: 1,
  }
}

async function requestCostEstimateManifest(request: ManifestTransportRequest) {
  try {
    return await postFlowsIdRunCostEstimates(
      {
        data: {
          executionMode: request.executionMode,
          executionRuntime: request.executionRuntime,
          expectedFlowRevision: request.expectedFlowRevision,
          fundingSource: 'credits',
          includeAll: request.includeAll,
          nodeIds: request.nodeScopes.map(scope => scope.nodeId),
        },
        id: request.flowId,
      },
      {
        headers: getOrganizationRequestHeaders(request.organizationId),
        signal: request.signal,
      },
    )
  }
  catch (error) {
    if (request.signal.aborted)
      throw new DOMException('Aborted', 'AbortError')
    throw error
  }
}

/**
 * Sends one bounded manifest request without retaining its response. Complete
 * and incomplete public estimates are written only to their per-scope keys.
 */
export function useRunCostEstimateManifestTransport(input: {
  /** Whether the current missing-scope batch is ready to request. */
  active: boolean
  /** Whole-Flow scope destination when this batch explicitly requests it. */
  allQueryKey?: QueryKey
  /** Debug-versus-live pricing policy. */
  executionMode: 'debug' | 'live'
  /** Credits execution driver, currently required to be managed. */
  executionRuntime: 'browser' | 'managed'
  /** Saved Flow revision the server must plan. */
  expectedFlowRevision: number
  /** Saved Flow whose scopes are being estimated. */
  flowId: string
  /** Whether this batch explicitly includes the engine-level all scope. */
  includeAll: boolean
  /** Missing direct-node scope destinations in this bounded batch. */
  nodeScopes: readonly RunCostEstimateManifestNodeScope[]
  /** Receives completeness metadata after one terminal request. */
  onRecoveryScopes: (scopes: readonly RunCostEstimateRecoveryScope[]) => void
  /** Receives transient network state without retaining estimate data. */
  onRequestStateChange: (state: RunCostEstimateManifestRequestState) => void
  /** Tenant owning the Flow and every referenced Asset. */
  organizationId: string
  /** Exact coordinator identity for this request attempt. */
  requestKey: string
}): void {
  const {
    active,
    allQueryKey,
    executionMode,
    executionRuntime,
    expectedFlowRevision,
    flowId,
    includeAll,
    nodeScopes,
    onRecoveryScopes,
    onRequestStateChange,
    organizationId,
    requestKey,
  } = input
  const queryClient = useQueryClient()
  const markScopesUnavailable = useCallback((request: ManifestTransportRequest) => {
    const recoveryScopes: RunCostEstimateRecoveryScope[] = []
    if (request.includeAll && request.allQueryKey) {
      queryClient.setQueryData(request.allQueryKey, unavailableEstimate())
      recoveryScopes.push({ complete: false, id: 'all' })
    }
    for (const scope of request.nodeScopes) {
      queryClient.setQueryData(scope.queryKey, unavailableEstimate())
      recoveryScopes.push({ complete: false, id: `node:${scope.nodeId}` })
    }
    return recoveryScopes
  }, [queryClient])
  const { mutate: requestManifest } = useMutation({
    gcTime: 0,
    mutationFn: async (request: ManifestTransportRequest) => {
      const manifest = await requestCostEstimateManifest(request)
      if (manifest.flowRevision !== request.expectedFlowRevision)
        return markScopesUnavailable(request)

      const recoveryScopes: RunCostEstimateRecoveryScope[] = []
      if (request.includeAll && request.allQueryKey) {
        const estimate = manifest.allCostEstimate ?? unavailableEstimate()
        queryClient.setQueryData(request.allQueryKey, estimate)
        recoveryScopes.push({
          complete: isCompleteEstimate(estimate),
          id: 'all',
        })
      }
      const estimatesByNodeId = new Map(
        manifest.nodes.map(node => [node.nodeId, node.costEstimate]),
      )
      for (const scope of request.nodeScopes) {
        const estimate = estimatesByNodeId.get(scope.nodeId)
          ?? unavailableEstimate()
        queryClient.setQueryData(scope.queryKey, estimate)
        recoveryScopes.push({
          complete: isCompleteEstimate(estimate),
          id: `node:${scope.nodeId}`,
        })
      }
      return recoveryScopes
    },
    retry: (failureCount, error) => failureCount < ESTIMATE_REQUEST_RETRY_LIMIT
      && retryableEstimateRequestError(error),
    retryDelay: failureCount => Math.min(
      ESTIMATE_REQUEST_RETRY_BASE_MS * 2 ** failureCount,
      4_000,
    ),
  })

  useEffect(() => {
    if (!active)
      return undefined
    const controller = new AbortController()
    const request: ManifestTransportRequest = {
      ...(includeAll && allQueryKey
        ? { allQueryKey }
        : {}),
      executionMode,
      executionRuntime,
      expectedFlowRevision,
      flowId,
      includeAll,
      nodeScopes,
      organizationId,
      requestKey,
      signal: controller.signal,
    }
    onRequestStateChange({ key: request.requestKey, status: 'fetching' })
    requestManifest(request, {
      onError: () => {
        if (controller.signal.aborted)
          return
        onRecoveryScopes(markScopesUnavailable(request))
        onRequestStateChange({ key: request.requestKey, status: 'error' })
      },
      onSuccess: (recoveryScopes) => {
        if (controller.signal.aborted)
          return
        onRecoveryScopes(recoveryScopes)
        onRequestStateChange({ key: request.requestKey, status: 'success' })
      },
    })
    return () => controller.abort()
  }, [
    active,
    allQueryKey,
    executionMode,
    executionRuntime,
    expectedFlowRevision,
    flowId,
    includeAll,
    markScopesUnavailable,
    nodeScopes,
    onRecoveryScopes,
    onRequestStateChange,
    organizationId,
    requestKey,
    requestManifest,
  ])
}
