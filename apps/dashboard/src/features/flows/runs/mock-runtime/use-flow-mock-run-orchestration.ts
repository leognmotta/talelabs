/** Canvas command orchestration for durable live and debug Flow runs. */

import type {
  FlowRunExecutionMode,
  FlowRunExecutionRuntime,
} from '@talelabs/flows'
import type { FlowLatestResult } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { RefObject } from 'react'
import type { AssetDestinationSelection } from '../../../projects/asset-destination-picker'
import type { CanvasStore } from '../../editor/canvas-state/canvas-store'
import type { FlowReferenceData } from '../../editor/flow-canvas-types'
import type { FlowGenerationRunOptions } from './flow-mock-runtime-node-scope'

import { isGenerationNodeType } from '@talelabs/flows'
import { postRunsIdRetry, postRunsIdRetryEstimate } from '@talelabs/sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { useCreditAdmissionGuard } from '../../../billing/use-credit-admission-guard'
import { useGenerationRunAdmission } from '../../../generation/runs/use-generation-run-admission'
import { useSettingsTabState } from '../../../settings/settings-state'
import { generationPreviewHistory } from '../../generation/flow-generation-preview-history'
import { publishBrowserRunHint, rememberActiveBrowserRun } from '../browser-runtime/browser-run-hints'
import { activePreviewNodeIdsFromClosure } from '../observation/flow-run-active-selection'
import { isActiveRunStatus } from '../observation/flow-run-status'
import { useFlowRunObservation } from '../observation/use-flow-run-observation'
import { createFlowMockRuntimePlanner } from './flow-mock-runtime-planner'

/** Coordinates canvas commands while admission, observation, and projection stay isolated. */
export function useFlowMockRunOrchestration(input: {
  destinationFolderId: AssetDestinationSelection
  executionMode: FlowRunExecutionMode
  executionRuntime: FlowRunExecutionRuntime
  flowId: string
  fundingSource: 'byok' | 'credits'
  initialActiveRunIds: readonly string[]
  initialLatestResults: readonly FlowLatestResult[]
  locale: string
  organizationId: string
  referenceDataRef: RefObject<FlowReferenceData>
  saveNow: (options?: {
    reconcileWithServer?: boolean
  }) => Promise<null | number>
  store: CanvasStore
  t: TFunction
  userId: string | undefined
}) {
  const {
    executionMode,
    destinationFolderId,
    executionRuntime,
    flowId,
    fundingSource,
    initialActiveRunIds,
    initialLatestResults,
    locale,
    organizationId,
    referenceDataRef,
    saveNow,
    store,
    t,
    userId,
  } = input
  const ensureSaved = useCallback(async () => {
    const revision = await saveNow()
    return revision === null ? null : { flowId, revision }
  }, [flowId, saveNow])
  const [, setSettingsTab] = useSettingsTabState()
  const queryClient = useQueryClient()
  const {
    ensureCreditsAvailable,
    handleInsufficientCreditsError,
    recordCreditAdmission,
    showApiKeyRequired,
  } = useCreditAdmissionGuard(organizationId)
  const creditRequired = fundingSource === 'credits'
    && executionRuntime === 'managed'
  const openSecureStore = useCallback(() => {
    void setSettingsTab('secureStore')
  }, [setSettingsTab])
  const getEdges = useCallback(() => store.getState().edges, [store])
  const observation = useFlowRunObservation({
    getEdges,
    flowId,
    initialActiveRunIds,
    initialLatestResults,
    organizationId,
    openSecureStore,
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
  const plannerCacheRef = useRef<null | {
    edges: object
    locale: string
    nodes: object
    planner: ReturnType<typeof createFlowMockRuntimePlanner>
    previews: object
    referenceData: FlowReferenceData
  }>(null)
  const createCurrentPlanner = useCallback(
    () => {
      const state = store.getState()
      const previews = previewsRef.current
      const referenceData = referenceDataRef.current
      const cached = plannerCacheRef.current
      if (
        cached?.edges === state.edges
        && cached.locale === locale
        && cached.nodes === state.nodes
        && cached.previews === previews
        && cached.referenceData === referenceData
      ) {
        return cached.planner
      }
      const planner = createFlowMockRuntimePlanner({
        edges: state.edges,
        locale,
        nodes: state.nodes,
        previews,
        referenceData,
      })
      plannerCacheRef.current = {
        edges: state.edges,
        locale,
        nodes: state.nodes,
        planner,
        previews,
        referenceData,
      }
      return planner
    },
    [locale, previewsRef, referenceDataRef, store],
  )
  const admitRun = useGenerationRunAdmission({
    destinationFolderId,
    ensureSaved,
    executionMode,
    executionRuntime,
    fundingSource,
    observeRun,
    organizationId,
    userId,
  })

  const markPreviewScope = useCallback(
    (nodeIds: readonly string[]) => {
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
    },
    [createCurrentPlanner, store, updateRunStatePreview],
  )

  const markPreviewScopeFailed = useCallback(
    (nodeIds: readonly string[]) => {
      const currentPlanner = createCurrentPlanner()
      for (const nodeId of nodeIds) {
        const current = previewsRef.current[nodeId]
        updatePreview(nodeId, {
          fingerprint: currentPlanner.getFingerprint(nodeId) ?? nodeId,
          ...generationPreviewHistory(current),
          status: 'error',
        })
      }
    },
    [createCurrentPlanner, previewsRef, updatePreview],
  )

  const handleAdmissionFailure = useCallback(
    (
      reason:
        | 'credential_required'
        | 'credential_store_unavailable'
        | 'save_failed'
        | undefined,
      nodeIds: readonly string[],
    ) => {
      if (!reason)
        return false
      markPreviewScopeFailed(nodeIds)
      if (reason === 'save_failed') {
        toast.error(t('flows.saveStatus.error'))
        return true
      }
      if (reason === 'credential_required') {
        showApiKeyRequired()
        return true
      }
      openSecureStore()
      toast.error(
        t(
          `flows.browserExecution.${reason}` as 'flows.browserExecution.credential_required',
        ),
      )
      return true
    },
    [markPreviewScopeFailed, openSecureStore, showApiKeyRequired, t],
  )

  const retryGenerationRun = useCallback(
    async (nodeId: string) => {
      const previous = previewsRef.current[nodeId]
      if (!previous?.retrySource)
        return
      try {
        const retryRequest = {
          executionMode,
          expectedRunStatus: previous.retrySource.status,
        }
        const estimate = await postRunsIdRetryEstimate(
          { data: retryRequest, id: previous.retrySource.runId },
          { headers: getOrganizationRequestHeaders(organizationId) },
        )
        if (estimate.costEstimate.status !== 'estimated') {
          toast.error(t('errors.run_cost_estimate_unavailable'))
          return
        }
        const quotedCredits = estimate.costEstimate.estimatedCredits
        if (quotedCredits > 0 && !await ensureCreditsAvailable(quotedCredits))
          return
        updateRunStatePreview(nodeId, previous.fingerprint, 'pending')
        const run = await postRunsIdRetry(
          {
            data: retryRequest,
            id: previous.retrySource.runId,
          },
          {
            headers: {
              ...getOrganizationRequestHeaders(organizationId),
              'Idempotency-Key': globalThis.crypto.randomUUID(),
            },
          },
        )
        observeRun(run)
        if (quotedCredits > 0)
          recordCreditAdmission(quotedCredits)
        if (run.executionRuntime === 'browser' && userId) {
          rememberActiveBrowserRun(queryClient, organizationId, userId, run.id)
          publishBrowserRunHint(
            run.flowId,
            organizationId,
            run.source,
            userId,
            run.id,
          )
        }
      }
      catch (error) {
        updatePreview(nodeId, previous)
        if (handleInsufficientCreditsError(error))
          return
        toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
      }
    },
    [
      ensureCreditsAvailable,
      executionMode,
      handleInsufficientCreditsError,
      observeRun,
      organizationId,
      previewsRef,
      queryClient,
      recordCreditAdmission,
      t,
      updatePreview,
      updateRunStatePreview,
      userId,
    ],
  )

  const runGenerationPreview = useCallback(
    async (nodeId: string, options: FlowGenerationRunOptions = {}) => {
      if (
        creditRequired
        && (
          options.estimatedCredits === undefined
          || !await ensureCreditsAvailable(
            options.estimatedCredits,
          )
        )
      ) {
        return
      }
      const scope = options.scope ?? 'node'
      const mode
        = scope === 'fromHere'
          ? 'downstream'
          : scope === 'tillHere'
            ? 'upstream'
            : 'node'
      const nodeIds = createCurrentPlanner().getPreviewNodeIds(nodeId, scope)
      markPreviewScope(nodeIds)
      try {
        const result = await admitRun({ mode, targetNodeId: nodeId })
        handleAdmissionFailure(result.reason, nodeIds)
        if (creditRequired && result.run) {
          recordCreditAdmission(options.estimatedCredits!)
        }
      }
      catch (error) {
        markPreviewScopeFailed(nodeIds)
        if (handleInsufficientCreditsError(error))
          return
        toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
      }
    },
    [
      admitRun,
      creditRequired,
      createCurrentPlanner,
      ensureCreditsAvailable,
      handleInsufficientCreditsError,
      handleAdmissionFailure,
      markPreviewScope,
      markPreviewScopeFailed,
      recordCreditAdmission,
      t,
    ],
  )

  const runGenerationSelectionPreview = useCallback(
    async (
      selectedNodeIds: readonly string[],
      estimatedCredits?: number,
    ) => {
      if (
        creditRequired
        && (
          estimatedCredits === undefined
          || !await ensureCreditsAvailable(estimatedCredits)
        )
      ) {
        return
      }
      const nodeIds = [...new Set(selectedNodeIds)]
      markPreviewScope(nodeIds)
      try {
        const result = await admitRun({
          mode: 'selection',
          selectedNodeIds: nodeIds,
        })
        handleAdmissionFailure(result.reason, nodeIds)
        if (creditRequired && result.run)
          recordCreditAdmission(estimatedCredits!)
      }
      catch (error) {
        markPreviewScopeFailed(nodeIds)
        if (handleInsufficientCreditsError(error))
          return
        toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
      }
    },
    [
      admitRun,
      creditRequired,
      ensureCreditsAvailable,
      handleAdmissionFailure,
      handleInsufficientCreditsError,
      markPreviewScope,
      markPreviewScopeFailed,
      recordCreditAdmission,
      t,
    ],
  )

  const runAll = useCallback(async (estimatedCredits?: number) => {
    if (
      creditRequired
      && (
        estimatedCredits === undefined
        || !await ensureCreditsAvailable(estimatedCredits)
      )
    ) {
      return
    }
    setRunAllAdmissionRunning(true)
    const nodeIds = store
      .getState()
      .nodes
      .filter(node => isGenerationNodeType(node.type))
      .map(node => node.id)
    markPreviewScope(nodeIds)
    try {
      const result = await admitRun({ mode: 'all' })
      handleAdmissionFailure(result.reason, nodeIds)
      if (creditRequired && result.run)
        recordCreditAdmission(estimatedCredits!)
      if (result.run && !isActiveRunStatus(result.run.status))
        setRunAllAdmissionRunning(false)
    }
    catch (error) {
      markPreviewScopeFailed(nodeIds)
      if (handleInsufficientCreditsError(error))
        return
      toast.error(getApiErrorMessage(error, t('flows.runStatus.failed')))
    }
    finally {
      setRunAllAdmissionRunning(false)
    }
  }, [
    admitRun,
    creditRequired,
    ensureCreditsAvailable,
    handleAdmissionFailure,
    handleInsufficientCreditsError,
    markPreviewScope,
    markPreviewScopeFailed,
    recordCreditAdmission,
    setRunAllAdmissionRunning,
    store,
    t,
  ])
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
