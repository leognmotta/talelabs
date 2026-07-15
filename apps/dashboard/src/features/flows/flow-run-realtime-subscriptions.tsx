import { postRunsIdRealtimeToken } from '@talelabs/sdk'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { flowQueryKeys } from './flow-query-keys'
import { useActiveFlowRunsQuery } from './flow.queries'

const REALTIME_ERROR_BASE_COOLDOWN_MS = 30_000
const REALTIME_ERROR_MAX_COOLDOWN_MS = 5 * 60_000
const REALTIME_INITIAL_CONNECT_TIMEOUT_MS = 5_000
const REALTIME_TOKEN_ERROR_REFRESH_INTERVAL_MS = 60_000
const REALTIME_TOKEN_STALE_TIME_MS = 5 * 60_000

export function FlowRunRealtimeSubscriptions({
  organizationId,
}: {
  organizationId: string
}) {
  const activeRunsQuery = useActiveFlowRunsQuery()
  const activeRunIds = activeRunsQuery.data ?? []

  return (
    <>
      {activeRunIds.map(runId => (
        <FlowRunRealtimeTokenSubscription
          key={runId}
          organizationId={organizationId}
          runId={runId}
        />
      ))}
    </>
  )
}

function FlowRunRealtimeTokenSubscription({
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
      : millisecondsUntilTokenRefresh(query.state.data?.expiresAt),
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
    void invalidateRunAndActiveQueries(queryClient, organizationId, runId)
  }, [organizationId, queryClient, runId])

  useEffect(() => {
    if (!coolingDown)
      return
    const timeout = window.setTimeout(() => {
      setNow(Date.now())
      void queryClient.invalidateQueries({
        queryKey: flowQueryKeys.runRealtimeToken(organizationId, runId),
      })
    }, cooldownUntil - now)
    return () => window.clearTimeout(timeout)
  }, [cooldownUntil, coolingDown, now, organizationId, queryClient, runId])

  useEffect(() => {
    if (!tokenQuery.isError)
      return
    void queryClient.invalidateQueries({
      queryKey: flowQueryKeys.run(organizationId, runId),
    })
    void queryClient.invalidateQueries({
      queryKey: flowQueryKeys.activeRuns(organizationId),
    })
  }, [organizationId, queryClient, runId, tokenQuery.isError])

  if (coolingDown)
    return null
  if (!tokenQuery.data)
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

function FlowRunRealtimeRunSubscription({
  accessToken,
  expiresAt,
  onRealtimeError,
  onRealtimeRecovered,
  organizationId,
  runId,
  triggerRunId,
}: {
  accessToken: string
  expiresAt: string
  onRealtimeError: () => void
  onRealtimeRecovered: () => void
  organizationId: string
  runId: string
  triggerRunId: string
}) {
  const queryClient = useQueryClient()
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false)
  const [subscriptionId] = useState(
    () => `${triggerRunId}:${expiresAt}:${globalThis.crypto.randomUUID()}`,
  )
  const failureReportedRef = useRef(false)
  const { error, run, stop } = useRealtimeRun(triggerRunId, {
    accessToken,
    enabled: subscriptionEnabled,
    id: subscriptionId,
    onComplete: () => {
      void invalidateRunAndActiveQueries(queryClient, organizationId, runId)
    },
    skipColumns: ['payload', 'output'],
  })
  const lastObservedSignatureRef = useRef<null | string>(null)

  // React Strict Mode replays mount effects in development. Enabling on the
  // next task prevents two concurrent Trigger streams for the same run.
  useEffect(() => {
    const timeout = window.setTimeout(setSubscriptionEnabled, 0, true)
    return () => window.clearTimeout(timeout)
  }, [accessToken, expiresAt, triggerRunId])

  const reportRealtimeFailure = useCallback(() => {
    if (failureReportedRef.current)
      return
    failureReportedRef.current = true
    stop()
    onRealtimeError()
  }, [onRealtimeError, stop])

  useEffect(() => {
    if (!error)
      return
    reportRealtimeFailure()
  }, [error, reportRealtimeFailure])

  // Trigger's underlying ShapeStream retries HTTP 429 internally and may not
  // surface an error. Abort a connection that never yields its initial run so
  // the bounded cooldown and PostgreSQL recovery path can take ownership.
  useEffect(() => {
    if (!subscriptionEnabled || run || error)
      return
    const timeout = window.setTimeout(
      reportRealtimeFailure,
      REALTIME_INITIAL_CONNECT_TIMEOUT_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [error, reportRealtimeFailure, run, subscriptionEnabled])

  useEffect(() => {
    if (!run)
      return
    onRealtimeRecovered()
    const signature = JSON.stringify([
      run.status,
      run.metadata,
      run.updatedAt,
      run.isCompleted,
    ])
    if (signature === lastObservedSignatureRef.current)
      return
    lastObservedSignatureRef.current = signature
    void invalidateRunQuery(queryClient, organizationId, runId)
  }, [expiresAt, onRealtimeRecovered, organizationId, queryClient, run, runId])

  return null
}

function invalidateRunQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  runId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: flowQueryKeys.run(organizationId, runId),
  })
}

function invalidateRunAndActiveQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  runId: string,
) {
  return Promise.allSettled([
    invalidateRunQuery(queryClient, organizationId, runId),
    queryClient.invalidateQueries({
      queryKey: flowQueryKeys.activeRuns(organizationId),
    }),
  ])
}

function millisecondsUntilTokenRefresh(expiresAt: string | undefined) {
  if (!expiresAt)
    return 10_000
  const refreshAt = new Date(expiresAt).getTime() - 60_000
  const delay = refreshAt - Date.now()
  return Math.max(30_000, delay)
}
