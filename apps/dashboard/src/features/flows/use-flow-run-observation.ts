/**
 * Active Flow-run observation, canvas synchronization, and terminal feedback.
 *
 */

import type { FlowLatestResult, FlowRun } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { RefObject } from 'react'
import type { CanvasEdge, FlowGenerationPreview } from './flow-canvas-types'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import { areGenerationPreviewsEqual } from './flow-generation-preview-comparison'
import {
  generationPreviewHistory,
  initialPreviewsFromLatestResults,
  preserveMountedMediaOutputs,
} from './flow-generation-preview-history'
import { flowQueryKeys } from './flow-query-keys'
import { activeRunNodeIdsFromRun } from './flow-run-active-selection'
import { activeRunIdsReducer, stableRunIds } from './flow-run-active-state'
import {
  previewFromOutputJobs,
} from './flow-run-preview-projection'
import { isActiveRunStatus, isRetryableRunStatus } from './flow-run-status'
import { useFlowRunDetailQueries } from './flow.queries'

/** Observes active runs and projects their progress and outputs onto the canvas. */
export function useFlowRunObservation(input: {
  edgesRef: RefObject<CanvasEdge[]>
  flowId: string
  initialActiveRunIds: readonly string[]
  initialLatestResults: readonly FlowLatestResult[]
  organizationId: string
  t: TFunction
}) {
  const {
    edgesRef,
    flowId,
    initialActiveRunIds,
    initialLatestResults,
    organizationId,
    t,
  } = input
  const initialPreviewsRef = useRef<Readonly<Record<string, FlowGenerationPreview>> | null>(null)
  if (initialPreviewsRef.current === null) {
    initialPreviewsRef.current = initialPreviewsFromLatestResults(
      initialLatestResults,
      t,
    )
  }
  const [previews, setPreviews] = useState<Readonly<Record<string, FlowGenerationPreview>>>(
    () => initialPreviewsRef.current ?? {},
  )
  const previewsRef = useRef(previews)
  const [runAllRunIds, dispatchRunAllRunIds] = useReducer(
    activeRunIdsReducer,
    [],
    stableRunIds,
  )
  const [activeRunIds, dispatchActiveRunIds] = useReducer(
    activeRunIdsReducer,
    initialActiveRunIds,
    stableRunIds,
  )
  const queryClient = useQueryClient()
  const runDetailQueries = useFlowRunDetailQueries(activeRunIds)
  const terminalRunIdsRef = useRef(new Set<string>())
  const refreshedTerminalRunIdsRef = useRef(new Set<string>())
  const notifiedTerminalFailureRunIdsRef = useRef(new Set<string>())

  const updatePreview = useCallback((
    nodeId: string,
    preview: FlowGenerationPreview,
  ) => {
    const current = previewsRef.current[nodeId]
    if (current && areGenerationPreviewsEqual(current, preview))
      return
    const next = { ...previewsRef.current, [nodeId]: preview }
    previewsRef.current = next
    setPreviews(next)
  }, [])

  const updateRunStatePreview = useCallback((
    nodeId: string,
    fingerprint: string,
    status: 'pending' | 'queued',
  ) => {
    const current = previewsRef.current[nodeId]
    updatePreview(nodeId, {
      fingerprint,
      ...generationPreviewHistory(current),
      status,
    })
  }, [updatePreview])

  const updateFromRun = useCallback((run: FlowRun) => {
    const terminal = !isActiveRunStatus(run.status)
    if (terminalRunIdsRef.current.has(run.id) && !terminal)
      return
    if (terminal)
      terminalRunIdsRef.current.add(run.id)
    if (run.mode === 'all') {
      dispatchRunAllRunIds({
        runId: run.id,
        type: terminal ? 'remove' : 'add',
      })
    }

    const failedJob = run.nodes
      .flatMap(node => node.jobs)
      .find(job => job.status === 'failed')
    const terminalFailure = terminal && (
      run.status === 'failed'
      || run.status === 'partial'
      || Boolean(failedJob)
    )
    if (
      terminalFailure
      && !notifiedTerminalFailureRunIdsRef.current.has(run.id)
    ) {
      notifiedTerminalFailureRunIdsRef.current.add(run.id)
      const errorCode = failedJob?.errorCode ?? run.errorCode
      const fallbackMessage = failedJob?.errorMessage
        ?? run.errorMessage
        ?? t('flows.runStatus.failed')
      const message = errorCode === 'provider_insufficient_balance'
        ? t('errors.provider_insufficient_balance')
        : errorCode?.startsWith('provider_')
          ? fallbackMessage
          : errorCode
            ? t(`errors.${errorCode}` as 'errors.internal_error', {
                defaultValue: fallbackMessage,
              })
            : fallbackMessage
      toast.error(message, { id: `flow-run-failure-${run.id}` })
    }

    const activeNodeIds = activeRunNodeIdsFromRun({
      edges: edgesRef.current,
      run,
    })
    for (const node of run.nodes) {
      const fingerprint = run.planHash || run.id
      const preview = previewFromOutputJobs({
        fingerprint,
        jobs: node.jobs
          .filter(job => job.status === 'succeeded')
          .map(job => ({
            assetOutputs: job.assetOutputs,
            itemKey: job.itemKey,
            jobId: job.id,
            textOutputs: job.textOutputs,
          })),
        nodeId: node.nodeId,
        t,
      })
      if (!preview) {
        if (node.status === 'pending' || node.status === 'running') {
          updateRunStatePreview(
            node.nodeId,
            fingerprint,
            activeNodeIds.has(node.nodeId) ? 'pending' : 'queued',
          )
        }
        else if (['failed', 'canceled', 'skipped'].includes(node.status)) {
          const current = previewsRef.current[node.nodeId]
          updatePreview(node.nodeId, {
            fingerprint,
            ...generationPreviewHistory(current),
            ...(terminal && isRetryableRunStatus(run.status)
              ? { retrySource: { runId: run.id, status: run.status } }
              : {}),
            status: 'error',
          })
        }
        continue
      }
      const mountedPreview = preserveMountedMediaOutputs(
        previewsRef.current[node.nodeId],
        preview,
      )
      updatePreview(node.nodeId, terminal && node.status !== 'succeeded'
        ? {
            ...mountedPreview,
            ...(isRetryableRunStatus(run.status)
              ? { retrySource: { runId: run.id, status: run.status } }
              : {}),
            status: 'error',
          }
        : mountedPreview)
    }
    if (terminal) {
      dispatchActiveRunIds({ runId: run.id, type: 'remove' })
      terminalRunIdsRef.current.delete(run.id)
      if (!refreshedTerminalRunIdsRef.current.has(run.id)) {
        refreshedTerminalRunIdsRef.current.add(run.id)
        void Promise.all([
          queryClient.invalidateQueries({
            exact: true,
            queryKey: flowQueryKeys.graph(organizationId, flowId),
          }),
          queryClient.invalidateQueries({
            exact: true,
            queryKey: flowQueryKeys.references(organizationId, flowId),
          }),
        ])
      }
    }
  }, [
    edgesRef,
    flowId,
    organizationId,
    queryClient,
    t,
    updatePreview,
    updateRunStatePreview,
  ])

  const observeRun = useCallback((run: FlowRun) => {
    updateFromRun(run)
    queryClient.setQueryData(flowQueryKeys.run(organizationId, run.id), run)
    void queryClient.invalidateQueries({
      queryKey: flowQueryKeys.activeRuns(organizationId),
    })
    if (isActiveRunStatus(run.status))
      dispatchActiveRunIds({ runId: run.id, type: 'add' })
  }, [organizationId, queryClient, updateFromRun])

  const projection = useMemo(() => ({
    runs: runDetailQueries
      .map(query => query.data)
      .filter((run): run is FlowRun => Boolean(run)),
    signature: runDetailQueries.map(query => query.dataUpdatedAt).join(':'),
  }), [runDetailQueries])
  useEffect(() => {
    for (const run of projection.runs)
      updateFromRun(run)
  // eslint-disable-next-line react/exhaustive-deps -- dataUpdatedAt is the stable useQueries projection boundary.
  }, [projection.signature, updateFromRun])

  const setRunAllAdmissionRunning = useCallback((running: boolean) => {
    dispatchRunAllRunIds({
      runId: 'run-all-admission',
      type: running ? 'add' : 'remove',
    })
  }, [])

  return {
    isRunAllRunning: runAllRunIds.length > 0,
    observeRun,
    previews,
    previewsRef,
    setRunAllAdmissionRunning,
    updatePreview,
    updateRunStatePreview,
  }
}
