/** Canvas command orchestration for durable live and debug Flow runs. */

import type { FlowRunExecutionMode } from '@talelabs/flows'
import type { FlowLatestResult } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { RefObject } from 'react'
import type { CanvasStore } from './canvas-state/canvas-store'
import type { FlowReferenceData } from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { isGenerationNodeType } from '@talelabs/flows'
import { postRunsIdRetry } from '@talelabs/sdk'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { generationPreviewHistory } from './flow-generation-preview-history'
import { createFlowMockRuntimePlanner } from './flow-mock-runtime-planner'
import { activePreviewNodeIdsFromClosure } from './flow-run-active-selection'
import { isActiveRunStatus } from './flow-run-status'
import { useFlowRunAdmission } from './use-flow-run-admission'
import { useFlowRunObservation } from './use-flow-run-observation'

/** Coordinates canvas commands while admission, observation, and projection stay isolated. */
export function useFlowMockRunOrchestration(input: {
  executionMode: FlowRunExecutionMode
  flowId: string
  initialActiveRunIds: readonly string[]
  initialLatestResults: readonly FlowLatestResult[]
  locale: string
  organizationId: string
  referenceDataRef: RefObject<FlowReferenceData>
  saveNow: (options?: { reconcileWithServer?: boolean }) => Promise<null | number>
  store: CanvasStore
  t: TFunction
}) {
  const {
    executionMode,
    flowId,
    initialActiveRunIds,
    initialLatestResults,
    locale,
    organizationId,
    referenceDataRef,
    saveNow,
    store,
    t,
  } = input
  const getEdges = useCallback(() => store.getState().edges, [store])
  const observation = useFlowRunObservation({
    getEdges,
    flowId,
    initialActiveRunIds,
    initialLatestResults,
    organizationId,
    t,
  })
  const {
    isRunAllRunning,
    observeRun,
    getGenerationPreview,
    previewsRef,
    setRunAllAdmissionRunning,
    subscribeGenerationPreviews,
    updatePreview,
    updateRunStatePreview,
  } = observation
  const createCurrentPlanner = useCallback(() => createFlowMockRuntimePlanner({
    edges: store.getState().edges,
    locale,
    nodes: store.getState().nodes,
    previews: previewsRef.current,
    referenceData: referenceDataRef.current,
  }), [
    locale,
    previewsRef,
    referenceDataRef,
    store,
  ])
  const admitRun = useFlowRunAdmission({
    executionMode,
    flowId,
    observeRun,
    organizationId,
    saveNow,
  })

  const markPreviewScope = useCallback((nodeIds: readonly string[]) => {
    const activeNodeIds = activePreviewNodeIdsFromClosure({
      edges: store.getState().edges,
      nodes: store.getState().nodes,
      previewNodeIds: nodeIds,
    })
    const currentPlanner = createCurrentPlanner()
    for (const nodeId of nodeIds) {
      const node = store.getState().nodes.find(item => item.id === nodeId)
      if (!node || !isGenerationNodeType(node.type))
        continue
      updateRunStatePreview(
        nodeId,
        currentPlanner.getFingerprint(nodeId) ?? nodeId,
        activeNodeIds.has(nodeId) ? 'pending' : 'queued',
      )
    }
  }, [createCurrentPlanner, store, updateRunStatePreview])

  const markPreviewScopeFailed = useCallback((nodeIds: readonly string[]) => {
    const currentPlanner = createCurrentPlanner()
    for (const nodeId of nodeIds) {
      const current = previewsRef.current[nodeId]
      updatePreview(nodeId, {
        fingerprint: currentPlanner.getFingerprint(nodeId) ?? nodeId,
        ...generationPreviewHistory(current),
        status: 'error',
      })
    }
  }, [createCurrentPlanner, previewsRef, updatePreview])

  const retryGenerationRun = useCallback(async (nodeId: string) => {
    const previous = previewsRef.current[nodeId]
    if (!previous?.retrySource)
      return
    updateRunStatePreview(nodeId, previous.fingerprint, 'pending')
    try {
      const run = await postRunsIdRetry({
        data: {
          executionMode,
          expectedRunStatus: previous.retrySource.status,
        },
        id: previous.retrySource.runId,
      }, {
        headers: {
          ...getOrganizationRequestHeaders(organizationId),
          'Idempotency-Key': globalThis.crypto.randomUUID(),
        },
      })
      observeRun(run)
    }
    catch (error) {
      updatePreview(nodeId, previous)
      toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
    }
  }, [executionMode, observeRun, organizationId, previewsRef, t, updatePreview, updateRunStatePreview])

  const runGenerationPreview = useCallback(async (
    nodeId: string,
    scope: FlowGenerationPreviewScope = 'node',
  ) => {
    const mode = scope === 'fromHere'
      ? 'downstream'
      : scope === 'tillHere' ? 'upstream' : 'node'
    const nodeIds = createCurrentPlanner().getPreviewNodeIds(nodeId, scope)
    markPreviewScope(nodeIds)
    try {
      const result = await admitRun({ mode, targetNodeId: nodeId })
      if (result.reason === 'save_failed') {
        markPreviewScopeFailed(nodeIds)
        toast.error(t('flows.saveStatus.error'))
      }
    }
    catch (error) {
      markPreviewScopeFailed(nodeIds)
      toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
    }
  }, [admitRun, createCurrentPlanner, markPreviewScope, markPreviewScopeFailed, t])

  const runGenerationSelectionPreview = useCallback(async (
    selectedNodeIds: readonly string[],
  ) => {
    const nodeIds = [...new Set(selectedNodeIds)]
    markPreviewScope(nodeIds)
    try {
      const result = await admitRun({ mode: 'selection', selectedNodeIds: nodeIds })
      if (result.reason === 'save_failed') {
        markPreviewScopeFailed(nodeIds)
        toast.error(t('flows.saveStatus.error'))
      }
    }
    catch (error) {
      markPreviewScopeFailed(nodeIds)
      toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
    }
  }, [admitRun, markPreviewScope, markPreviewScopeFailed, t])

  const runAll = useCallback(async () => {
    setRunAllAdmissionRunning(true)
    const nodeIds = store.getState().nodes.filter(node => isGenerationNodeType(node.type)).map(node => node.id)
    markPreviewScope(nodeIds)
    try {
      const result = await admitRun({ mode: 'all' })
      if (result.reason === 'save_failed') {
        markPreviewScopeFailed(nodeIds)
        toast.error(t('flows.saveStatus.error'))
      }
      if (result.run && !isActiveRunStatus(result.run.status))
        setRunAllAdmissionRunning(false)
    }
    catch (error) {
      markPreviewScopeFailed(nodeIds)
      toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
    }
    finally {
      setRunAllAdmissionRunning(false)
    }
  }, [admitRun, markPreviewScope, markPreviewScopeFailed, setRunAllAdmissionRunning, store, t])
  const getGenerationPreviewFingerprint = useCallback(
    (nodeId: string) => createCurrentPlanner().getFingerprint(nodeId),
    [createCurrentPlanner],
  )
  const getExecutableInputCount = useCallback(
    (nodeId: string, slotId: string) =>
      createCurrentPlanner().getExecutableInputCount(nodeId, slotId),
    [createCurrentPlanner],
  )

  return {
    getExecutableInputCount,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    isRunAllRunning,
    retryGenerationRun,
    runAll,
    runGenerationPreview,
    runGenerationSelectionPreview,
    subscribeGenerationPreviews,
  }
}
