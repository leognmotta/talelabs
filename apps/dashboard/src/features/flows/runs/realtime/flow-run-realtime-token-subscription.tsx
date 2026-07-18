/** Token lifecycle for authenticated Trigger.dev realtime subscriptions. */

import { postRunsIdRealtimeToken } from '@talelabs/sdk'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'
import {
  invalidateFlowRunAndActiveQueries,
  millisecondsUntilFlowRunTokenRefresh,
} from './flow-run-realtime-query'
import { FlowRunRealtimeRunSubscription } from './flow-run-realtime-run-subscription'

const REALTIME_ERROR_BASE_COOLDOWN_MS = 30_000
const REALTIME_ERROR_MAX_COOLDOWN_MS = 5 * 60_000
const REALTIME_TOKEN_ERROR_REFRESH_INTERVAL_MS = 60_000
const REALTIME_TOKEN_STALE_TIME_MS = 5 * 60_000

/** Loads and refreshes one run token before mounting the realtime subscription. */
export function FlowRunRealtimeTokenSubscription({
  organizationId,
  runId,
}: {
  organizationId: string
  runId: string
}) {
  const queryClient = useQueryClient()
  const realtimeErrorCountRef = useRef(0)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const coolingDown = cooldownUntil > now
  const tokenQuery = useQuery({
    enabled: Boolean(organizationId && runId && !coolingDown),
    queryFn: ({ signal }) => postRunsIdRealtimeToken(
      { id: runId },
      {
        headers: getOrganizationRequestHeaders(organizationId),
        signal,
      },
    ),
    queryKey: flowQueryKeys.runRealtimeToken(organizationId, runId),
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.error
      ? REALTIME_TOKEN_ERROR_REFRESH_INTERVAL_MS
      : millisecondsUntilFlowRunTokenRefresh(query.state.data?.expiresAt),
    retry: 2,
    retryDelay: attempt => Math.min(5_000, 1_000 * 2 ** attempt),
    staleTime: REALTIME_TOKEN_STALE_TIME_MS,
  })

  const handleRealtimeRecovered = useCallback(() => {
    realtimeErrorCountRef.current = 0
  }, [])
  const handleRealtimeError = useCallback(() => {
    realtimeErrorCountRef.current += 1
    const currentTime = Date.now()
    const cooldownMs = Math.min(
      REALTIME_ERROR_MAX_COOLDOWN_MS,
      REALTIME_ERROR_BASE_COOLDOWN_MS
      * 2 ** (realtimeErrorCountRef.current - 1),
    )
    setNow(currentTime)
    setCooldownUntil(currentTime + cooldownMs)
    void invalidateFlowRunAndActiveQueries(
      queryClient,
      organizationId,
      runId,
    )
  }, [organizationId, queryClient, runId])

  useEffect(() => {
    if (!coolingDown)
      return
    const timeout = window.setTimeout(() => {
      setNow(Date.now())
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: flowQueryKeys.runRealtimeToken(organizationId, runId),
      })
    }, cooldownUntil - now)
    return () => window.clearTimeout(timeout)
  }, [cooldownUntil, coolingDown, now, organizationId, queryClient, runId])

  useEffect(() => {
    if (!tokenQuery.isError)
      return
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: flowQueryKeys.run(organizationId, runId),
    })
    void queryClient.invalidateQueries({
      exact: true,
      queryKey: flowQueryKeys.activeRuns(organizationId),
    })
  }, [organizationId, queryClient, runId, tokenQuery.isError])

  if (coolingDown || !tokenQuery.data)
    return null

  return (
    <FlowRunRealtimeRunSubscription
      key={`${tokenQuery.data.triggerRunId}:${tokenQuery.data.expiresAt}`}
      accessToken={tokenQuery.data.publicAccessToken}
      expiresAt={tokenQuery.data.expiresAt}
      onRealtimeError={handleRealtimeError}
      onRealtimeRecovered={handleRealtimeRecovered}
      organizationId={organizationId}
      runId={runId}
      triggerRunId={tokenQuery.data.triggerRunId}
    />
  )
}
