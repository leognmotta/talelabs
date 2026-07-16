import { useQueryClient } from '@tanstack/react-query'
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  invalidateFlowRunAndActiveQueries,
  invalidateFlowRunQuery,
} from './flow-run-realtime-query'

const REALTIME_INITIAL_CONNECT_TIMEOUT_MS = 5_000

export function FlowRunRealtimeRunSubscription({
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
      void invalidateFlowRunAndActiveQueries(
        queryClient,
        organizationId,
        runId,
      )
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
    if (error)
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
    void invalidateFlowRunQuery(queryClient, organizationId, runId)
  }, [expiresAt, onRealtimeRecovered, organizationId, queryClient, run, runId])

  return null
}
