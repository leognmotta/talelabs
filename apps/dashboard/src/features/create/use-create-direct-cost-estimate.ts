/**
 * Debounced cost estimation for one browser-local direct Create request.
 *
 * The endpoint invokes the same server compiler and cost resolver as admission;
 * no Flow persistence or graph synchronization is involved.
 */

import type { CreateDirectRunRequest } from '@talelabs/sdk'
import type { GenerationRunCostEstimateState } from '../generation/runs/use-saved-generation-run-cost-estimate'

import { ApiError, postRunsCreateEstimate } from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { flowQueryKeys } from '../flows/data/query-keys/flow-query-keys'
import { useBoundedIncompleteEstimateRecovery } from '../flows/runs/cost-estimation/use-bounded-incomplete-estimate-recovery'

const DIRECT_ESTIMATE_DEBOUNCE_MS = 600
const DIRECT_ESTIMATE_RETRY_BASE_MS = 1_000
const DIRECT_ESTIMATE_RETRY_LIMIT = 2
const DIRECT_ESTIMATE_STALE_MS = 5 * 60_000
const DIRECT_INCOMPLETE_ESTIMATE_STALE_MS = 30_000

function retryableEstimateError(error: unknown) {
  return !(error instanceof ApiError)
    || error.status === 429
    || error.status >= 500
}

/** Resolves the compact shared cost state for the current direct request. */
export function useCreateDirectCostEstimate(input: {
  /** Whether current funding policy requires platform cost estimation. */
  costRequired: boolean
  /** Whether the request is complete enough to compile. */
  enabled: boolean
  /** Active tenant owning referenced Assets. */
  organizationId: string
  /** Current bounded public direct request, or null while invalid. */
  request: CreateDirectRunRequest | null
}): GenerationRunCostEstimateState {
  const requestFingerprint = useMemo(
    () => input.request ? JSON.stringify(input.request) : '',
    [input.request],
  )
  const [settledFingerprint, setSettledFingerprint] = useState('')
  useEffect(() => {
    const timeout = window.setTimeout(
      setSettledFingerprint,
      requestFingerprint ? DIRECT_ESTIMATE_DEBOUNCE_MS : 0,
      requestFingerprint,
    )
    return () => window.clearTimeout(timeout)
  }, [requestFingerprint])
  const settledRequest = settledFingerprint
    ? JSON.parse(settledFingerprint) as CreateDirectRunRequest
    : null
  const queryKey = flowQueryKeys.createRunCostEstimate({
    executionMode: input.request?.executionMode ?? 'live',
    organizationId: input.organizationId,
    requestFingerprint,
  })
  const queryEnabled = input.costRequired
    && input.enabled
    && Boolean(input.request)
    && Boolean(settledRequest)
    && settledFingerprint === requestFingerprint
    && input.request?.executionMode === 'live'
    && input.request.executionRuntime === 'managed'
    && input.request.fundingSource === 'credits'
  const query = useQuery({
    enabled: queryEnabled,
    gcTime: DIRECT_ESTIMATE_STALE_MS,
    queryFn: ({ signal }) => {
      const request = { ...settledRequest! }
      delete request.byokProviders
      return postRunsCreateEstimate(
        {
          data: {
            ...request,
            executionRuntime: 'managed',
            fundingSource: 'credits',
          },
        },
        {
          headers: getOrganizationRequestHeaders(input.organizationId),
          signal,
        },
      ).then(response => response.costEstimate)
    },
    queryKey,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => failureCount < DIRECT_ESTIMATE_RETRY_LIMIT
      && retryableEstimateError(error),
    retryDelay: failureCount => Math.min(
      DIRECT_ESTIMATE_RETRY_BASE_MS * 2 ** failureCount,
      4_000,
    ),
    staleTime: current => current.state.data?.status === 'estimated'
      ? DIRECT_ESTIMATE_STALE_MS
      : DIRECT_INCOMPLETE_ESTIMATE_STALE_MS,
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

  if (!input.costRequired || input.request?.executionMode === 'debug')
    return { status: 'not-required' }
  if (!input.enabled || !input.request)
    return { status: 'idle' }
  if (settledFingerprint !== requestFingerprint)
    return { status: 'updating' }
  if (query.data?.status === 'estimated' && query.data.estimatedJobCount > 0) {
    return {
      estimate: query.data,
      status: 'ready',
    }
  }
  if (query.isPending || query.isFetching)
    return { status: 'estimating' }
  return { status: 'idle' }
}
