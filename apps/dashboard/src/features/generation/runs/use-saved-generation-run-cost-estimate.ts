/** Saved-revision provider-cost estimation shared by canvas and Create. */

import type { NormalizedFlowRunCommand } from '@talelabs/flows'
import type {
  FlowRunPlanRequest,
  RunCostEstimate,
} from '@talelabs/sdk'

import { ApiError, postFlowsIdRunPlans } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { flowQueryKeys } from '../../flows/data/query-keys/flow-query-keys'
import { useBoundedIncompleteEstimateRecovery } from '../../flows/runs/cost-estimation/use-bounded-incomplete-estimate-recovery'

const ESTIMATE_REQUEST_RETRY_BASE_MS = 1_000
const ESTIMATE_REQUEST_RETRY_LIMIT = 2
const ESTIMATE_STALE_TIME_MS = 5 * 60_000
const INCOMPLETE_ESTIMATE_STALE_TIME_MS = 30_000

type CompleteRunCostEstimate = Extract<RunCostEstimate, { status: 'estimated' }>

/** Saved-plan estimate state used to authorize generation admission. */
export type GenerationRunCostEstimateState
  = | { /** Complete provider estimate returned by canonical preflight. */ estimate: CompleteRunCostEstimate, status: 'ready' }
    | { /** Stable state rendered while canonical preflight is in flight. */ status: 'estimating' }
    | { /** No complete estimate is currently available. */ status: 'idle' }
    | { /** BYOK and debug requests intentionally skip platform estimation. */ status: 'not-required' }
    | { /** Local edits must reach a confirmed Flow revision first. */ status: 'updating' }

/** Reports whether cost policy allows the related generation command. */
export function isGenerationRunCostEstimateReady(
  state: GenerationRunCostEstimateState,
): boolean {
  return state.status === 'not-required' || state.status === 'ready'
}

function retryableEstimateRequestError(error: unknown): boolean {
  return !(error instanceof ApiError)
    || error.status === 429
    || error.status >= 500
}

/** Queries the canonical run planner for one exact saved Flow revision. */
export function useSavedGenerationRunCostEstimate(input: {
  /** Normalized graph-selection command whose total is requested. */
  command: NormalizedFlowRunCommand
  /** Whether current funding/mode policy requires a provider estimate. */
  costRequired: boolean
  /** Whether local graph state differs from the confirmed revision. */
  dirty: boolean
  /** Whether the owning control currently exposes this estimate. */
  enabled: boolean
  /** Immutable live-versus-debug choice for the next request. */
  executionMode: 'debug' | 'live'
  /** Runtime driver selected for the next request. */
  executionRuntime: 'browser' | 'managed'
  /** Backing ordinary Flow identity. */
  flowId: null | string
  /** Active tenant owning the Flow. */
  organizationId: null | string
  /** Whether this consumer should issue the request instead of awaiting a seed. */
  requestDirectly: boolean
  /** Confirmed revision captured in the preflight command. */
  savedRevision: number
  /** Cost-relevant identity used by the shared Flow estimate cache. */
  scopeFingerprint: string
}): GenerationRunCostEstimateState {
  const command: FlowRunPlanRequest['command'] = {
    ...input.command,
    expectedFlowRevision: input.savedRevision,
  } as FlowRunPlanRequest['command']
  const queryKey = flowQueryKeys.runCostEstimate({
    command: input.command,
    executionMode: input.executionMode,
    executionRuntime: input.executionRuntime,
    flowId: input.flowId,
    organizationId: input.organizationId,
    scopeFingerprint: input.scopeFingerprint,
  })
  const queryEnabled = input.costRequired
    && input.enabled
    && input.requestDirectly
    && !input.dirty
    && Boolean(input.flowId && input.organizationId)
    && input.executionMode === 'live'
    && input.executionRuntime === 'managed'
  const query = useQuery({
    enabled: queryEnabled,
    gcTime: ESTIMATE_STALE_TIME_MS,
    queryFn: ({ signal }) => postFlowsIdRunPlans(
      {
        data: {
          command,
          executionMode: input.executionMode,
          executionRuntime: input.executionRuntime,
          fundingSource: 'credits',
        },
        id: input.flowId!,
      },
      {
        headers: getOrganizationRequestHeaders(input.organizationId!),
        signal,
      },
    ).then(response => response.costEstimate),
    queryKey,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => failureCount < ESTIMATE_REQUEST_RETRY_LIMIT
      && retryableEstimateRequestError(error),
    retryDelay: failureCount => Math.min(
      ESTIMATE_REQUEST_RETRY_BASE_MS * 2 ** failureCount,
      4_000,
    ),
    staleTime: current => current.state.data?.status === 'estimated'
      ? ESTIMATE_STALE_TIME_MS
      : INCOMPLETE_ESTIMATE_STALE_TIME_MS,
  })
  const refetchEstimate = query.refetch
  const recoverIncompleteEstimate = useCallback(() => {
    void refetchEstimate({ cancelRefetch: false })
  }, [refetchEstimate])
  const recordEstimateRecoveryScopes = useBoundedIncompleteEstimateRecovery({
    active: queryEnabled,
    groupKey: JSON.stringify(queryKey),
    recover: recoverIncompleteEstimate,
    recovering: query.isFetching,
  })

  useEffect(() => {
    if (query.data) {
      recordEstimateRecoveryScopes([{
        complete: query.data.status === 'estimated',
        id: 'scope',
      }])
    }
    else if (query.isError) {
      recordEstimateRecoveryScopes([{ complete: false, id: 'scope' }])
    }
  }, [query.data, query.isError, recordEstimateRecoveryScopes])

  if (!input.costRequired || input.executionMode === 'debug')
    return { status: 'not-required' }
  if (!input.enabled)
    return { status: 'idle' }
  if (input.dirty || !input.flowId)
    return { status: 'updating' }
  if (query.data?.status === 'estimated' && query.data.estimatedJobCount > 0) {
    return {
      estimate: query.data,
      status: 'ready',
    }
  }
  if (query.data)
    return { status: 'idle' }
  if (!input.requestDirectly)
    return { status: 'estimating' }
  if (query.isPending || query.isFetching)
    return { status: 'estimating' }
  return { status: 'idle' }
}
