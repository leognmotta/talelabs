/**
 * Responsive workspace for one browser-local direct request and durable runs.
 *
 * The reducer owns only editable request state. Server state is limited to the
 * catalog, creator-scoped run history, and canonical output Assets.
 */

import type { CreateSession, GenerationConfigResponse } from '@talelabs/sdk'
import type { CreateDraft } from './create-draft'

import { Alert, AlertDescription } from '@talelabs/ui/components/alert'
import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { useQueryState } from 'nuqs'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { DARK_THEME_CLASS_NAME } from '../../shared/lib/theme'
import { useAssetViewerUrlState } from '../assets/viewer/use-asset-viewer-url-state'
import { flowCanvasSearchParams } from '../flows/editor/persistence/flow-canvas-search-params'
import { useExecutionRuntimePreference } from '../settings/execution-runtime-preference'
import {
  resolveGenerationExecutionRuntime,
  useGenerationFundingPreference,
} from '../settings/generation-funding-preference'
import { useSettingsTabState } from '../settings/settings-state'
import { CreateComposer } from './create-composer'
import { createDirectRequest } from './create-direct-request'
import { createEmptyCreateDraft, hasCreateDraftContent } from './create-draft'
import {
  deleteCreateDraftCache,
  writeCreateDraftCache,
} from './create-draft-cache'
import { createDraftReducer } from './create-draft-reducer'
import { CreateEmptyStage } from './create-empty-stage'
import { resolveCreateDraft } from './create-resolution'
import { useCreateRunHistoryQuery } from './data/create-run-history.queries'
import {
  getCreateHistoryViewPreference,
  storeCreateHistoryViewPreference,
} from './history/create-history-view-preference'
import { CreateHistoryViewToggle } from './history/create-history-view-toggle'
import { CreateRunGrid } from './history/create-run-grid'
import { CreateRunStream } from './history/create-run-stream'
import { CreateSessionPicker } from './sessions/create-session-picker'
import { useCreateBrowserAvailability } from './use-create-browser-availability'
import { useCreateCredentialStatus } from './use-create-credential-status'
import { useCreateDirectCostEstimate } from './use-create-direct-cost-estimate'
import { useCreateRunActions } from './use-create-run-actions'

/** Owns the local draft while direct run state remains in query caches. */
export function CreateWorkspace({
  canUseDebugMode,
  createSession,
  generationConfig,
  initialDraft,
  organizationId,
  userId,
}: {
  /** Existing account capability controlling debug-mode visibility. */
  canUseDebugMode: boolean
  /** Durable session selected by the route, or null for a new draft. */
  createSession: CreateSession | null
  /** Sanitized public catalog projection. */
  generationConfig: GenerationConfigResponse
  /** Same-tab recovered request used to initialize local reducer state. */
  initialDraft: CreateDraft
  /** Active tenant owning referenced Assets and admitted runs. */
  organizationId: string
  /** Authenticated user used for local recovery and browser execution. */
  userId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const viewer = useAssetViewerUrlState()
  const [, setSettingsTab] = useSettingsTabState()
  const [state, dispatch] = useReducer(createDraftReducer, {
    draft: initialDraft,
    notice: null,
  })
  const resolution = useMemo(
    () => resolveCreateDraft(state.draft),
    [state.draft],
  )
  const [fundingSource] = useGenerationFundingPreference(userId)
  const [byokRuntime] = useExecutionRuntimePreference(userId)
  const executionRuntime = resolveGenerationExecutionRuntime(
    fundingSource,
    byokRuntime,
  )
  const [requestedDebugMode, setRequestedDebugMode] = useQueryState(
    'debug',
    flowCanvasSearchParams.debug,
  )
  const debugMode = canUseDebugMode && requestedDebugMode
  const executionMode = debugMode ? 'debug' : 'live'
  const credentials = useCreateCredentialStatus(userId)
  const browserAvailability = useCreateBrowserAvailability({
    enabled: executionMode === 'live'
      && executionRuntime === 'browser'
      && credentials.status === 'ready',
    modelId: state.draft.modelId,
    operationId: resolution.resolvedOperationId,
    organizationId,
    providers: credentials.providers,
  })
  const directRequest = useMemo(() => createDirectRequest({
    byokProviders: [...credentials.providers],
    draft: state.draft,
    executionMode,
    executionRuntime,
    fundingSource,
    resolution,
  }), [
    credentials.providers,
    executionMode,
    executionRuntime,
    fundingSource,
    resolution,
    state.draft,
  ])
  const publicModel = generationConfig.models.find(
    model => model.id === state.draft.modelId,
  )
  const publicOperation = publicModel?.capabilities.operations.find(
    operation => operation.id === resolution.resolvedOperationId
      && operation.nodeType === resolution.nodeType,
  )
  const executionAvailable = Boolean(publicModel?.enabled && publicOperation)
  const estimateEligible = executionAvailable
    && resolution.readiness === 'ready'
    && resolution.promptValid
    && hasCreateDraftContent(state.draft)
    && Boolean(directRequest)
  const costRequired = fundingSource === 'credits'
    && executionMode === 'live'
    && executionRuntime === 'managed'
  const estimateState = useCreateDirectCostEstimate({
    costRequired,
    enabled: estimateEligible,
    organizationId,
    request: directRequest,
  })
  const createSessionId = createSession?.id ?? null
  const historyQuery = useCreateRunHistoryQuery(createSessionId)
  const runs = historyQuery.runs
  const hasRuns = runs.length > 0
  const [historyView, setHistoryView] = useState(
    getCreateHistoryViewPreference,
  )
  const [admissionPending, setAdmissionPending] = useState(false)
  const [scrollTargetRunId, setScrollTargetRunId] = useState<null | string>(null)
  const composerDockRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    writeCreateDraftCache({
      createSessionId,
      draft: state.draft,
      organizationId,
      userId,
    })
  }, [createSessionId, organizationId, state.draft, userId])

  useLayoutEffect(() => {
    const composerDock = composerDockRef.current
    const workspace = workspaceRef.current
    if (!composerDock || !workspace)
      return

    const updateComposerInset = () => {
      workspace.style.setProperty(
        '--create-composer-inset',
        `${Math.ceil(composerDock.getBoundingClientRect().height)}px`,
      )
    }
    updateComposerInset()

    if (typeof ResizeObserver === 'undefined')
      return

    const resizeObserver = new ResizeObserver(updateComposerInset)
    resizeObserver.observe(composerDock)
    return () => resizeObserver.disconnect()
  }, [])

  const openSecureStore = useCallback(() => {
    void setSettingsTab('secureStore')
  }, [setSettingsTab])
  const replaceDraft = useCallback((draft: CreateDraft) => {
    dispatch({ draft, type: 'replace' })
  }, [])
  const handleSessionCreated = useCallback((sessionId: string) => {
    writeCreateDraftCache({
      createSessionId: sessionId,
      draft: state.draft,
      organizationId,
      userId,
    })
    deleteCreateDraftCache({
      createSessionId: null,
      organizationId,
      userId,
    })
    navigate(`/create/${sessionId}`, { replace: true })
  }, [navigate, organizationId, state.draft, userId])
  const runActions = useCreateRunActions({
    createSessionId,
    draft: state.draft,
    onSessionCreated: handleSessionCreated,
    openSecureStore,
    organizationId,
    replaceDraft,
    request: directRequest,
    userId,
  })
  const historyPresentationProps = {
    generationConfig,
    hasEarlier: historyQuery.hasEarlier,
    loadingEarlier: historyQuery.loadingEarlier,
    runs,
    scrollTargetRunId,
    onCancel: (run: Parameters<typeof runActions.cancel>[0]) => {
      void runActions.cancel(run)
    },
    onLoadEarlier: () => {
      void historyQuery.loadEarlier()
    },
    onMakeVideo: (output: Parameters<typeof runActions.useOutput>[0]) => {
      void runActions.useOutput(output, true)
    },
    onOpenAsset: viewer.openAsset,
    onRetry: (run: Parameters<typeof runActions.retry>[0]) => {
      void runActions.retry(run)
    },
    onReuseRequest: (run: Parameters<typeof runActions.reuseRequest>[0]) => {
      void runActions.reuseRequest(run)
    },
    onUseAsReference: (
      output: Parameters<typeof runActions.useOutput>[0],
    ) => {
      void runActions.useOutput(output, false)
    },
  }

  let blockingReason: null | string = null
  if (!executionAvailable) {
    blockingReason = t('create.validation.modelUnavailable')
  }
  else if (resolution.readiness === 'incomplete') {
    blockingReason = t('create.validation.incomplete')
  }
  else if (resolution.readiness === 'invalid' || !resolution.promptValid) {
    blockingReason = t('create.validation.invalid')
  }
  else if (
    executionMode === 'live'
    && executionRuntime === 'browser'
    && credentials.status === 'loading'
  ) {
    blockingReason = t('common.loading')
  }
  else if (
    executionMode === 'live'
    && executionRuntime === 'browser'
    && (credentials.status !== 'ready' || credentials.providers.size === 0)
  ) {
    blockingReason = t('create.validation.connectProvider')
  }
  else if (
    executionMode === 'live'
    && executionRuntime === 'browser'
    && browserAvailability === 'checking'
  ) {
    blockingReason = t('common.loading')
  }
  else if (
    executionMode === 'live'
    && executionRuntime === 'browser'
    && browserAvailability !== 'available'
  ) {
    blockingReason = t('create.validation.connectProvider')
  }
  else if (costRequired && estimateState.status === 'updating') {
    blockingReason = t('create.validation.savingEstimate')
  }
  else if (costRequired && estimateState.status === 'estimating') {
    blockingReason = t('create.validation.estimating')
  }
  else if (costRequired && estimateState.status !== 'ready') {
    blockingReason = t('create.validation.estimateUnavailable')
  }

  const composer = (
    <div className="pointer-events-auto mx-auto w-full max-w-[920px] space-y-2">
      {state.notice && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{t('create.modelDetach.notice', { count: state.notice.count })}</span>
            <Button
              className="h-auto p-0"
              type="button"
              variant="link"
              onClick={() => dispatch({ type: 'undoModelDetach' })}
            >
              {t('common.undo')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <CreateComposer
        blockingReason={blockingReason}
        canUseDebugMode={canUseDebugMode}
        debugMode={debugMode}
        disabled={admissionPending}
        draft={state.draft}
        estimateState={estimateState}
        generationConfig={generationConfig}
        resolution={resolution}
        onAddAttachment={attachment =>
          dispatch({ attachment, type: 'addAttachment' })}
        onAudioIntentChange={audioIntent =>
          dispatch({ audioIntent, type: 'setAudioIntent' })}
        onDebugModeChange={enabled => void setRequestedDebugMode(enabled)}
        onGenerate={() => {
          if (blockingReason || admissionPending)
            return
          setAdmissionPending(true)
          void runActions.generate()
            .then((run) => {
              if (run)
                setScrollTargetRunId(run.id)
            })
            .finally(() => setAdmissionPending(false))
        }}
        onLyricsChange={lyrics => dispatch({ lyrics, type: 'setLyrics' })}
        onModeChange={mode => dispatch({ mode, type: 'setMode' })}
        onModelChange={model => dispatch({ model, type: 'setModel' })}
        onPromptChange={prompt => dispatch({ prompt, type: 'setPrompt' })}
        onRemoveAttachment={attachmentId =>
          dispatch({ attachmentId, type: 'removeAttachment' })}
        onReorderAttachments={attachmentIds =>
          dispatch({ attachmentIds, type: 'reorderAttachments' })}
        onSettingChange={(settingId, value) => dispatch({
          settingId,
          type: 'setSetting',
          value,
        })}
      />
    </div>
  )

  return (
    <div
      className={`
        ${DARK_THEME_CLASS_NAME}
        relative flex size-full min-h-0 overflow-hidden bg-background
        text-foreground
      `}
    >
      <CreateSessionPicker
        currentSession={createSession}
        organizationId={organizationId}
        onCreateNew={() => {
          dispatch({ draft: createEmptyCreateDraft(), type: 'replace' })
          setScrollTargetRunId(null)
        }}
      />
      {hasRuns && (
        <div className="absolute top-4 right-4 z-30">
          <CreateHistoryViewToggle
            view={historyView}
            onViewChange={(nextView) => {
              setHistoryView(nextView)
              storeCreateHistoryViewPreference(nextView)
            }}
          />
        </div>
      )}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        ref={workspaceRef}
      >
        <main className={cn(
          'min-h-0 overflow-hidden',
          hasRuns ? 'absolute inset-0' : 'flex-1',
        )}
        >
          {!hasRuns
            ? (
                <div className="size-full overflow-y-auto overscroll-contain">
                  <CreateEmptyStage />
                </div>
              )
            : (
                historyView === 'grid'
                  ? <CreateRunGrid {...historyPresentationProps} />
                  : <CreateRunStream {...historyPresentationProps} />
              )}
        </main>
        <div
          className={cn(
            `
              pointer-events-none z-20 px-3 pt-3
              pb-[max(0.75rem,env(safe-area-inset-bottom))]
              sm:px-6 sm:pb-5
            `,
            hasRuns ? 'absolute inset-x-0 bottom-0' : 'shrink-0',
          )}
          ref={composerDockRef}
        >
          {composer}
        </div>
      </div>
    </div>
  )
}
