/** Interactive React Flow canvas and durable generation-run integration. */

import type { FlowCanvasProps } from './flow-canvas-props'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'

import {
  ContextMenu,
  ContextMenuTrigger,
} from '@talelabs/ui/components/context-menu'
import { cn } from '@talelabs/ui/lib/utils'
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react'
import { useQueryState } from 'nuqs'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCEPTED_ASSET_MEDIA } from '../../assets/upload/asset-upload-files'
import { useSession } from '../../auth/auth-client'
import { useGenerationExecutionSettings } from '../../settings/generation-funding-preference'
import { FLOW_REACT_NODE_TYPES } from '../nodes/flow-dashboard-node-registry'
import { useFlowRunAvailability } from '../runs/admission/use-flow-run-availability'
import { FlowRunCostEstimateProvider } from '../runs/cost-estimation/flow-run-cost-estimate-provider'
import { useFlowMockRunOrchestration } from '../runs/mock-runtime/use-flow-mock-run-orchestration'
import {
  CanvasStoreProvider,
  useCanvasStore,
  useCanvasStoreApi,
} from './canvas-state/canvas-store-context'
import { FlowCanvasConnectionLine } from './flow-canvas-connection-line'
import { FlowCanvasDebugIndicator } from './flow-canvas-debug-indicator'
import { FlowCanvasDropOverlay } from './flow-canvas-drop-overlay'
import { FlowCanvasEmptyState } from './flow-canvas-empty-state'
import { FlowCanvasMinimap } from './flow-canvas-minimap'
import { FlowCanvasOverlays } from './flow-canvas-overlays'
import {
  FlowCanvasHeaderPanel,
  FlowCanvasInspectorPanelSlot,
  FlowCanvasToolbarPanel,
} from './flow-canvas-panels'
import {
  FLOW_CANVAS_CONNECTION_LINE_STYLE,
  FLOW_CANVAS_DEFAULT_EDGE_OPTIONS,
  FLOW_CANVAS_DELETE_KEY_CODE,
  FLOW_CANVAS_EDGE_TYPES,
  FLOW_CANVAS_PRO_OPTIONS,
  FLOW_CANVAS_SNAP_GRID,
} from './flow-canvas-react-flow-config'
import { FlowCanvasRuntimeContext } from './flow-canvas-runtime-context'
import { FlowMediaPreviewProvider } from './flow-media-preview-provider'
import { getFlowCanvasShortcutLabels } from './interactions/flow-canvas-shortcuts'
import { useFlowCanvasAssetUpload } from './interactions/use-flow-canvas-asset-upload'
import { useFlowCanvasCommands } from './interactions/use-flow-canvas-commands'
import { useFlowCanvasFileDrop } from './interactions/use-flow-canvas-file-drop'
import { useFlowCanvasLifecycle } from './interactions/use-flow-canvas-lifecycle'
import { useFlowCanvasReactFlowHandlers } from './interactions/use-flow-canvas-react-flow-handlers'
import { useFlowVisibleEdges } from './interactions/use-flow-visible-edges'
import { flowCanvasSearchParams } from './persistence/flow-canvas-search-params'
import { useFlowAutosave } from './persistence/use-flow-autosave'
import { useFlowNavigationAutosave } from './persistence/use-flow-navigation-autosave'
import { useFlowReferenceData } from './persistence/use-flow-reference-data'
import { useFlowViewportPersistence } from './persistence/use-flow-viewport-persistence'
import '@xyflow/react/dist/style.css'

function FlowCanvasInner({
  canUseDebugMode,
  flow,
  generationConfig,
  graph,
  organizationId,
  references,
}: FlowCanvasProps) {
  const { i18n, t } = useTranslation()
  const session = useSession()
  const [fundingSource, executionRuntime] = useGenerationExecutionSettings(
    session.data?.user.id,
  )
  const store = useCanvasStoreApi()
  const nodes = useCanvasStore(state => state.nodes)
  const edges = useCanvasStore(state => state.edges)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const referenceDataRef = useRef<ReturnType<typeof useFlowReferenceData>>(
    null!,
  )
  const allowNavigationRef = useRef(false)
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>()
  const shortcutLabels = useMemo(getFlowCanvasShortcutLabels, [])
  const [requestedDebugMode, setDebugMode] = useQueryState(
    'debug',
    flowCanvasSearchParams.debug,
  )
  const debugMode = canUseDebugMode && requestedDebugMode
  const autosave = useFlowAutosave({
    flowId: flow.id,
    initialGraph: graph,
    organizationId,
  })
  useFlowNavigationAutosave({
    allowNavigationRef,
    dirty: autosave.dirty,
    flowId: flow.id,
    organizationId,
    saveNow: autosave.saveNow,
  })
  const assetUploads = useFlowCanvasAssetUpload({
    flowId: flow.id,
    organizationId,
    reactFlow,
    references,
    store,
    wrapperRef,
  })
  const transientElementData = useCanvasStore(
    state => state.transientElementData,
  )
  const referenceData = useFlowReferenceData(
    references,
    assetUploads.transientAssets,
    transientElementData,
  )
  referenceDataRef.current = referenceData
  const runs = useFlowMockRunOrchestration({
    executionMode: debugMode ? 'debug' : 'live',
    executionRuntime,
    flowId: flow.id,
    fundingSource,
    initialActiveRunIds: graph.activeRuns.map(run => run.runId),
    initialLatestResults: graph.latestResults,
    locale: i18n.resolvedLanguage ?? i18n.language ?? 'en',
    organizationId,
    referenceDataRef,
    saveNow: autosave.saveNow,
    store,
    t,
    userId: session.data?.user.id,
  })
  const {
    getExecutableInputCount,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    retryGenerationRun,
    runGenerationPreview,
    runGenerationSelectionPreview,
    subscribeGenerationPreviews,
  } = runs
  const runtime = useMemo(
    () => ({
      executionMode: debugMode ? 'debug' as const : 'live' as const,
      executionRuntime,
      flowId: flow.id,
      fundingSource,
      generationConfig,
      getAssetUpload: assetUploads.getUpload,
      getExecutableInputCount,
      getGenerationPreview,
      getGenerationPreviewFingerprint,
      organizationId,
      referenceData,
      retryGenerationRun,
      runGenerationPreview,
      subscribeAssetUploads: assetUploads.subscribeUploads,
      subscribeGenerationPreviews,
      userId: session.data?.user.id,
    }),
    [
      assetUploads.getUpload,
      assetUploads.subscribeUploads,
      generationConfig,
      debugMode,
      executionRuntime,
      flow.id,
      fundingSource,
      organizationId,
      referenceData,
      getExecutableInputCount,
      getGenerationPreview,
      getGenerationPreviewFingerprint,
      retryGenerationRun,
      runGenerationPreview,
      subscribeGenerationPreviews,
      session.data?.user.id,
    ],
  )
  const lifecycle = useFlowCanvasLifecycle({
    allowNavigationRef,
    defaultViewport: flow.viewport,
    discardPendingChanges: autosave.discard,
    nodeDescription: t('flows.a11y.nodeDescription'),
    store,
    uploadFiles: assetUploads.uploadFiles,
    viewportSaveFailedMessage: t('flows.viewportSaveFailed'),
  })
  const persistViewport = useFlowViewportPersistence({
    flowId: flow.id,
    onError: lifecycle.onViewportSaveError,
    organizationId,
  })
  const reactFlowHandlers = useFlowCanvasReactFlowHandlers({
    connectionRejectedMessage: t('flows.connectionRejected'),
    persistViewport,
    referenceDataRef,
    store,
  })
  const commands = useFlowCanvasCommands({
    reactFlow,
    referenceData,
    retrySave: autosave.retry,
    runGeneration: runGenerationPreview,
    runSelection: runGenerationSelectionPreview,
    store,
    wrapperRef,
  })
  const runAvailability = useFlowRunAvailability({
    generationConfig,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    store,
  })
  const fileDrop = useFlowCanvasFileDrop({
    uploadFilesAt: assetUploads.uploadFilesAt,
  })
  const visibleEdges = useFlowVisibleEdges({ edges, referenceData, store })

  return (
    <FlowCanvasRuntimeContext value={runtime}>
      <FlowRunCostEstimateProvider>
        <FlowMediaPreviewProvider>
          <input
            ref={assetUploads.fileInputRef}
            accept={ACCEPTED_ASSET_MEDIA}
            aria-label={t('assets.uploadFiles')}
            className="sr-only"
            multiple
            tabIndex={-1}
            type="file"
            onChange={lifecycle.handleFileChange}
          />
          <ContextMenu>
            <ContextMenuTrigger
              className={cn(
                'relative size-full overflow-hidden bg-background outline-none',
                debugMode && 'ring-2 ring-warning/70 ring-inset',
              )}
              render={(
                <div
                  ref={wrapperRef}
                  tabIndex={-1}
                  onDragEnter={fileDrop.onDragEnter}
                  onDragLeave={fileDrop.onDragLeave}
                  onDragOver={fileDrop.onDragOver}
                  onDrop={fileDrop.onDrop}
                  onKeyDown={lifecycle.handleCanvasKeyDown}
                  onPointerDownCapture={lifecycle.handleCanvasPointerDown}
                />
              )}
            >
              <ReactFlow
                aria-label={t('flows.a11y.canvas')}
                ariaLabelConfig={lifecycle.ariaLabelConfig}
                connectionLineComponent={FlowCanvasConnectionLine}
                connectionLineStyle={FLOW_CANVAS_CONNECTION_LINE_STYLE}
                defaultEdgeOptions={FLOW_CANVAS_DEFAULT_EDGE_OPTIONS}
                defaultViewport={lifecycle.defaultViewport}
                deleteKeyCode={FLOW_CANVAS_DELETE_KEY_CODE}
                edgeTypes={FLOW_CANVAS_EDGE_TYPES}
                edges={visibleEdges}
                fitView={graph.nodes.length === 0}
                isValidConnection={reactFlowHandlers.isValidConnection}
                maxZoom={2}
                minZoom={0.15}
                nodes={nodes}
                nodeTypes={FLOW_REACT_NODE_TYPES}
                onlyRenderVisibleElements
                proOptions={FLOW_CANVAS_PRO_OPTIONS}
                reconnectRadius={14}
                selectionMode={SelectionMode.Partial}
                snapGrid={FLOW_CANVAS_SNAP_GRID}
                snapToGrid
                onConnect={reactFlowHandlers.onConnect}
                onEdgeContextMenu={reactFlowHandlers.onEdgeContextMenu}
                onEdgesChange={reactFlowHandlers.onEdgesChange}
                onMoveEnd={reactFlowHandlers.onMoveEnd}
                onNodeContextMenu={reactFlowHandlers.onNodeContextMenu}
                onNodeDoubleClick={reactFlowHandlers.onNodeDoubleClick}
                onNodesChange={reactFlowHandlers.onNodesChange}
                onPaneContextMenu={reactFlowHandlers.onPaneContextMenu}
                onReconnect={reactFlowHandlers.onReconnect}
                onSelectionChange={reactFlowHandlers.onSelectionChange}
                onSelectionContextMenu={reactFlowHandlers.onSelectionContextMenu}
              >
                <Background
                  color="var(--flow-dot)"
                  gap={20}
                  size={1.4}
                  variant={BackgroundVariant.Dots}
                />
                <FlowCanvasMinimap />
                <FlowCanvasHeaderPanel
                  flow={flow}
                  status={autosave.status}
                  onFlowDeleted={lifecycle.onFlowDeleted}
                  onRetrySave={commands.retrySave}
                />
                <FlowCanvasEmptyState
                  canAddNodeType={runAvailability.canAddNodeType}
                  onAddNode={commands.addNode}
                />
                {debugMode && (
                  <Panel className="m-4!" position="top-center">
                    <FlowCanvasDebugIndicator />
                  </Panel>
                )}
                <FlowCanvasInspectorPanelSlot />
                <FlowCanvasToolbarPanel
                  canAddNodeType={runAvailability.canAddNodeType}
                  canUseDebugMode={canUseDebugMode}
                  debugMode={debugMode}
                  shortcutLabels={shortcutLabels}
                  onAddNode={commands.addNode}
                  onDebugModeChange={setDebugMode}
                  onFitView={commands.fitView}
                />
              </ReactFlow>
              {fileDrop.dropActive && <FlowCanvasDropOverlay />}
            </ContextMenuTrigger>
            <FlowCanvasOverlays
              canAddNodeType={runAvailability.canAddNodeType}
              getCanRunNode={runAvailability.getCanRunNode}
              shortcutLabels={shortcutLabels}
              onAddNode={commands.addNode}
              onArrange={commands.arrangeSelection}
              onDeleteNodeIds={commands.deleteNodes}
              onDeleteSelection={commands.deleteSelection}
              onDuplicate={commands.duplicateNodes}
              onFitView={commands.fitView}
              onFocus={commands.focusSelection}
              onRunFromHere={commands.runFromHere}
              onRunNode={commands.runNode}
              onRunSelection={commands.runSelection}
              onRunTillHere={commands.runTillHere}
              onSelectAll={commands.selectAll}
              onUploadAssets={assetUploads.openFilePicker}
            />
          </ContextMenu>
        </FlowMediaPreviewProvider>
      </FlowRunCostEstimateProvider>
    </FlowCanvasRuntimeContext>
  )
}

/** Renders a scoped Zustand store and React Flow provider for one editable Flow. */
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <CanvasStoreProvider
      key={`${props.organizationId}:${props.flow.id}`}
      flowId={props.flow.id}
      graph={props.graph}
      organizationId={props.organizationId}
    >
      <ReactFlowProvider>
        <FlowCanvasInner {...props} />
      </ReactFlowProvider>
    </CanvasStoreProvider>
  )
}
