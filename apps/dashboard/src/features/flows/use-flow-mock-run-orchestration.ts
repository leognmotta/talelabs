import type { FlowLatestResult } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { RefObject } from 'react'
import type {
  CanvasEdge,
  CanvasNode,
  FlowReferenceData,
} from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { isGenerationNodeType } from '@talelabs/flows'
import { postRunsIdRetry } from '@talelabs/sdk'
import { useCallback, useMemo } from 'react'
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
  edges: readonly CanvasEdge[]
  edgesRef: RefObject<CanvasEdge[]>
  flowId: string
  initialActiveRunIds: readonly string[]
  initialLatestResults: readonly FlowLatestResult[]
  locale: string
  nodes: readonly CanvasNode[]
  nodesRef: RefObject<CanvasNode[]>
  organizationId: string
  referenceData: FlowReferenceData
  referenceDataRef: RefObject<FlowReferenceData>
  saveNow: (options?: { reconcileWithServer?: boolean }) => Promise<null | number>
  t: TFunction
}) {
  const {
    edges,
    edgesRef,
    flowId,
    initialActiveRunIds,
    initialLatestResults,
    locale,
    nodes,
    nodesRef,
    organizationId,
    referenceData,
    referenceDataRef,
    saveNow,
    t,
  } = input
  const observation = useFlowRunObservation({
    edgesRef,
    flowId,
    initialActiveRunIds,
    initialLatestResults,
    organizationId,
    t,
  })
  const {
    isRunAllRunning,
    observeRun,
    previews,
    previewsRef,
    setRunAllAdmissionRunning,
    updatePreview,
    updateRunStatePreview,
  } = observation
  const planner = useMemo(() => createFlowMockRuntimePlanner({
    edges,
    locale,
    nodes,
    previews,
    referenceData,
  }), [
    edges,
    locale,
    nodes,
    previews,
    referenceData,
  ])
  const createCurrentPlanner = useCallback(() => createFlowMockRuntimePlanner({
    edges: edgesRef.current,
    locale,
    nodes: nodesRef.current,
    previews: previewsRef.current,
    referenceData: referenceDataRef.current,
  }), [
    edgesRef,
    locale,
    nodesRef,
    previewsRef,
    referenceDataRef,
  ])
  const admitRun = useFlowRunAdmission({
    flowId,
    observeRun,
    organizationId,
    saveNow,
  })

  const markPreviewScope = useCallback((nodeIds: readonly string[]) => {
    const activeNodeIds = activePreviewNodeIdsFromClosure({
      edges: edgesRef.current,
      nodes: nodesRef.current,
      previewNodeIds: nodeIds,
    })
    const currentPlanner = createCurrentPlanner()
    for (const nodeId of nodeIds) {
      const node = nodesRef.current.find(item => item.id === nodeId)
      if (!node || !isGenerationNodeType(node.type))
        continue
      updateRunStatePreview(
        nodeId,
        currentPlanner.getFingerprint(nodeId) ?? nodeId,
        activeNodeIds.has(nodeId) ? 'pending' : 'queued',
      )
    }
  }, [createCurrentPlanner, edgesRef, nodesRef, updateRunStatePreview])

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
        data: { expectedRunStatus: previous.retrySource.status },
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
  }, [observeRun, organizationId, previewsRef, t, updatePreview, updateRunStatePreview])

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
    const nodeIds = nodesRef.current
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id)
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
  }, [admitRun, markPreviewScope, markPreviewScopeFailed, nodesRef, setRunAllAdmissionRunning, t])

  const getGenerationPreview = useCallback(
    (nodeId: string) => previews[nodeId],
    [previews],
  )
  const getGenerationPreviewFingerprint = useCallback(
    (nodeId: string) => planner.getFingerprint(nodeId),
    [planner],
  )

  return {
    getExecutableInputCount: planner.getExecutableInputCount,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    isRunAllRunning,
    previews,
    retryGenerationRun,
    runAll,
    runGenerationPreview,
    runGenerationSelectionPreview,
  }
}
