/** Saved-revision run-cost preflight query shared by every canvas run control. */

import type {
  FlowRunPlanRequest,
  RunCostEstimate,
} from '@talelabs/sdk'

import { ApiError, postFlowsIdRunPlans } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { useCanvasStore } from '../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../editor/flow-canvas-runtime-context'
import { useRunCostEstimateManifestFingerprint } from './flow-run-cost-estimate-provider'
import { runCostEstimateQueryKey } from './run-cost-estimate-query'
import {
  createRunCostEstimateScopeFingerprint,
  normalizeRunCostEstimateCommand,
} from './run-cost-estimate-scope-fingerprint'
import { useBoundedIncompleteEstimateRecovery } from './use-bounded-incomplete-estimate-recovery'

const ESTIMATE_REQUEST_RETRY_BASE_MS = 1_000
const ESTIMATE_REQUEST_RETRY_LIMIT = 2
const INCOMPLETE_ESTIMATE_STALE_TIME_MS = 30_000

type CompleteRunCostEstimate = Extract<RunCostEstimate, { status: 'estimated' }>

/** Saved-plan estimate state used to authorize the related run action. */
export type RunCostEstimateState
  = | { /** Complete provider estimate returned by preflight. */ estimate: CompleteRunCostEstimate, status: 'ready' }
    | { /** Stable non-data state rendered while the request is in flight. */ status: 'estimating' }
    | { /** Lazy node estimate has not been requested yet. */ status: 'idle' }
    | { /** BYOK runs do not request, display, or require provider-cost estimates. */ status: 'not-required' }
    | { /** Current local edits must save before they can be estimated. */ status: 'updating' }

/** Reports whether cost policy allows the related run action to proceed. */
export function isRunCostEstimateReady(
  state: RunCostEstimateState,
): boolean {
  return state.status === 'not-required' || state.status === 'ready'
}

function retryableEstimateRequestError(error: unknown): boolean {
  return !(error instanceof ApiError)
    || error.status === 429
    || error.status >= 500
}

/** Run-plan command before the hook supplies the current saved revision. */
export type RunCostEstimateCommand = FlowRunPlanRequest['command'] extends infer Command
  ? Command extends { expectedFlowRevision: number }
    ? Omit<Command, 'expectedFlowRevision'>
    : never
  : never

/** Queries the same saved-plan calculator used by Credits-funded admission. */
export function useFlowRunCostEstimate(input: {
  /** Provider-neutral run command whose total should be displayed. */
  command: RunCostEstimateCommand
  /** Whether this control currently intends to expose its estimate. */
  enabled: boolean
}): RunCostEstimateState {
  const runtime = useFlowCanvasRuntime()
  const normalizedCommand = normalizeRunCostEstimateCommand(input.command)
  const manifestFingerprint = useRunCostEstimateManifestFingerprint(
    normalizedCommand,
    input.enabled && runtime.fundingSource === 'credits',
  )
  const manifestScope = normalizedCommand.mode === 'all'
    || normalizedCommand.mode === 'node'
  const dirty = useCanvasStore(
    state => state.graphRevision !== state.savedRevision,
  )
  const serverRevision = useCanvasStore(state => state.serverRevision)
  const lazyScopeFingerprint = useCanvasStore(state => (
    input.enabled && !manifestScope
      ? createRunCostEstimateScopeFingerprint({
          command: normalizedCommand,
          edges: state.edges,
          nodes: state.nodes,
          referenceData: runtime.referenceData,
        })
      : ''
  ))
  const scopeFingerprint = manifestFingerprint ?? lazyScopeFingerprint
  const costEstimationEnabled = runtime.fundingSource === 'credits'
  const command: FlowRunPlanRequest['command'] = {
    ...normalizedCommand,
    expectedFlowRevision: serverRevision,
  } as FlowRunPlanRequest['command']
  const queryEnabled = costEstimationEnabled
    && input.enabled
    && !manifestScope
    && !dirty
    && Boolean(runtime.organizationId && runtime.flowId)
    && runtime.executionRuntime === 'managed'
  const queryKey = runCostEstimateQueryKey({
    command: normalizedCommand,
    executionMode: runtime.executionMode,
    executionRuntime: runtime.executionRuntime,
    flowId: runtime.flowId,
    organizationId: runtime.organizationId,
    scopeFingerprint,
  })
  const query = useQuery({
    enabled: queryEnabled,
    queryFn: async ({ signal }) => {
      const response = await postFlowsIdRunPlans(
        {
          data: {
            command,
            executionMode: runtime.executionMode,
            executionRuntime: runtime.executionRuntime,
            fundingSource: 'credits',
          },
          id: runtime.flowId,
        },
        {
          headers: getOrganizationRequestHeaders(runtime.organizationId),
          signal,
        },
      )
      return response.costEstimate
    },
    queryKey,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => failureCount < ESTIMATE_REQUEST_RETRY_LIMIT
      && retryableEstimateRequestError(error),
    retryDelay: failureCount => Math.min(
      ESTIMATE_REQUEST_RETRY_BASE_MS * 2 ** failureCount,
      4_000,
    ),
    staleTime: INCOMPLETE_ESTIMATE_STALE_TIME_MS,
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

  if (!costEstimationEnabled)
    return { status: 'not-required' }
  if (!input.enabled)
    return { status: 'idle' }
  if (query.data?.status === 'estimated' && query.data.estimatedJobCount > 0) {
    return {
      estimate: query.data,
      status: 'ready',
    }
  }
  if (query.data?.status === 'estimated' && query.data.estimatedJobCount === 0)
    return { status: 'idle' }
  if (query.data)
    return { status: 'idle' }
  if (dirty)
    return { status: 'updating' }
  if (manifestScope)
    return { status: 'estimating' }
  if (query.isPending || query.isFetching)
    return { status: 'estimating' }
  if (query.isError)
    return { status: 'idle' }
  return { status: 'idle' }
}
