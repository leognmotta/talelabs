/** Interactive React Flow canvas and durable generation-run integration. */

import type { Viewport } from '@xyflow/react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type { FlowCanvasProps } from './flow-canvas-props'
import type {
  CanvasEdge,
  CanvasNode,
} from './flow-canvas-types'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@talelabs/ui/components/context-menu'
import { cn } from '@talelabs/ui/lib/utils'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import { useQueryState } from 'nuqs'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'
import { toast } from 'sonner'
import { ACCEPTED_ASSET_MEDIA } from '../assets/asset-upload-files'
import { FlowCanvasContext } from './flow-canvas-context'
import { FlowCanvasContextMenuContent } from './flow-canvas-context-menu-content'
import { FlowCanvasDebugIndicator } from './flow-canvas-debug-indicator'
import { FlowCanvasDialogs } from './flow-canvas-dialogs'
import { isEditableCanvasTarget } from './flow-canvas-editable-target'
import { FlowCanvasHeader } from './flow-canvas-header'
import { FlowCanvasInspectorPanel } from './flow-canvas-inspector-panel'
import { createFlowCanvasNavigationDialog } from './flow-canvas-navigation-dialog'
import {
  FLOW_CANVAS_DEFAULT_EDGE_OPTIONS,
  FLOW_CANVAS_DELETE_KEY_CODE,
  FLOW_CANVAS_EDGE_TYPES,
  FLOW_CANVAS_PRO_OPTIONS,
  FLOW_CANVAS_SNAP_GRID,
} from './flow-canvas-react-flow-config'
import { flowCanvasSearchParams } from './flow-canvas-search-params'
import {
  toCanvasEdges,
  toCanvasNodes,
} from './flow-canvas-serialization'
import { getFlowCanvasShortcutLabels } from './flow-canvas-shortcuts'
import { FlowCanvasToolbar } from './flow-canvas-toolbar'
import { FLOW_REACT_NODE_TYPES } from './flow-dashboard-node-registry'
import { FlowMediaPreviewProvider } from './flow-media-preview-provider'
import { useFlowAutosave } from './use-flow-autosave'
import { useFlowCanvasAssetUpload } from './use-flow-canvas-asset-upload'
import { useFlowCanvasContextValue } from './use-flow-canvas-context-value'
import { useFlowCanvasController } from './use-flow-canvas-controller'
import { useFlowCanvasHistory } from './use-flow-canvas-history'
import { useFlowCanvasInspector } from './use-flow-canvas-inspector'
import { useFlowCanvasSelection } from './use-flow-canvas-selection'
import { useFlowMockRunOrchestration } from './use-flow-mock-run-orchestration'
import { useFlowReferenceData } from './use-flow-reference-data'
import { useFlowRunAvailability } from './use-flow-run-availability'
import { useFlowViewportPersistence } from './use-flow-viewport-persistence'
import { useFlowVisibleEdges } from './use-flow-visible-edges'
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
  const shortcutLabels = getFlowCanvasShortcutLabels()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>()
  const [nodes, setNodes] = useNodesState<CanvasNode>(toCanvasNodes(graph.nodes))
  const [edges, setEdges] = useEdgesState<CanvasEdge>(toCanvasEdges(graph.edges))
  const [assetPickerNodeId, setAssetPickerNodeId] = useState<null | string>(null)
  const [editingImageCropNodeId, setEditingImageCropNodeId] = useState<null | string>(null)
  const [requestedDebugMode, setDebugMode] = useQueryState(
    'debug',
    flowCanvasSearchParams.debug,
  )
  const debugMode = canUseDebugMode && requestedDebugMode
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const allowNavigationRef = useRef(false)
  nodesRef.current = nodes
  edgesRef.current = edges
  const selection = useFlowCanvasSelection({
    edgesRef,
    nodesRef,
    setEdges,
    setEditingImageCropNodeId,
    setNodes,
  })
  const {
    clearSelection,
    contextTarget,
    handleEdgeContextMenu,
    handleNodeContextMenu,
    handleNodeDoubleClick,
    handlePaneContextMenu,
    handleSelectionChange,
    handleSelectionContextMenu,
    selectAll,
    selectedEdgeIds,
    selectedNodeIds,
    setSelectedIds,
  } = selection

  const replaceGraph = useCallback((nextNodes: CanvasNode[], nextEdges: CanvasEdge[]) => {
    nodesRef.current = nextNodes
    edgesRef.current = nextEdges
    setNodes(nextNodes)
    setEdges(nextEdges)
  }, [edgesRef, nodesRef, setEdges, setNodes])
  const {
    canRedo,
    canUndo,
    capture: captureHistory,
    clear: clearHistory,
    redo: redoHistory,
    undo: undoHistory,
  } = useFlowCanvasHistory({
    clearSelection,
    edgesRef,
    nodesRef,
    replaceGraph,
  })
  const replaceGraphFromServer = useCallback((
    nextNodes: CanvasNode[],
    nextEdges: CanvasEdge[],
  ) => {
    clearHistory()
    replaceGraph(nextNodes, nextEdges)
  }, [clearHistory, replaceGraph])
  const autosave = useFlowAutosave({
    edges,
    flowId: flow.id,
    initialGraph: graph,
    nodes,
    organizationId,
    replaceGraph: replaceGraphFromServer,
  })
  const { markDirty, retry, saveNow, status } = autosave
  const assetUploads = useFlowCanvasAssetUpload({
    captureHistory,
    flowId: flow.id,
    markDirty,
    nodes,
    nodesRef,
    organizationId,
    reactFlow,
    references,
    setEdges,
    setNodes,
    setSelectedIds,
    wrapperRef,
  })
  const referenceData = useFlowReferenceData(
    references,
    assetUploads.transientAssets,
  )
  const referenceDataRef = useRef(referenceData)
  referenceDataRef.current = referenceData
  const undo = useCallback(() => {
    if (!undoHistory())
      return
    setEditingImageCropNodeId(null)
    markDirty()
  }, [markDirty, undoHistory])
  const redo = useCallback(() => {
    if (!redoHistory())
      return
    setEditingImageCropNodeId(null)
    markDirty()
  }, [markDirty, redoHistory])
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    !allowNavigationRef.current
    && autosave.dirty
    && (
      currentLocation.pathname !== nextLocation.pathname
      || currentLocation.search !== nextLocation.search
      || currentLocation.hash !== nextLocation.hash
    )
  ))
  const [savingBeforeLeave, setSavingBeforeLeave] = useState(false)
  const showViewportSaveError = useCallback(() => {
    toast.error(t('flows.viewportSaveFailed'))
  }, [t])
  const persistViewport = useFlowViewportPersistence({
    flowId: flow.id,
    onError: showViewportSaveError,
    organizationId,
  })
  const rejectConnection = useCallback(() => {
    toast.error(t('flows.connectionRejected'))
  }, [t])

  const saveBeforeLeaving = useCallback(async () => {
    setSavingBeforeLeave(true)
    const saved = await saveNow()
    setSavingBeforeLeave(false)
    if (saved !== null && blocker.state === 'blocked')
      blocker.proceed()
  }, [blocker, saveNow])

  const controller = useFlowCanvasController({
    captureHistory,
    clearSelection,
    edgesRef,
    markDirty,
    nodesRef,
    onConnectionRejected: rejectConnection,
    reactFlow,
    referenceDataRef,
    selectedEdgeIds,
    selectedNodeIds,
    setEdges,
    setEditingImageCropNodeId,
    setNodes,
    setSelectedIds,
    wrapperRef,
  })
  const {
    addNode,
    autoFormatSelection,
    deleteNodes,
    deleteSelection,
    duplicateNodes,
    getIncompatibleGenerationEdgeCount,
    getIncompatibleGenerationEdges,
    getInputState,
    getNode,
    isValidConnection,
    onConnect,
    onEdgesChange,
    onNodesChange,
    onReconnect,
    updateGenerationConfiguration,
    updateNodeData,
    updateNodeReference,
  } = controller
  const {
    getExecutableInputCount,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    isRunAllRunning,
    retryGenerationRun,
    runAll,
    runGenerationPreview,
    runGenerationSelectionPreview,
  } = useFlowMockRunOrchestration({
    edges,
    edgesRef,
    executionMode: debugMode ? 'debug' : 'live',
    flowId: flow.id,
    initialActiveRunIds: graph.activeRuns.map(run => run.runId),
    initialLatestResults: graph.latestResults,
    locale: i18n.resolvedLanguage ?? i18n.language ?? 'en',
    nodes,
    nodesRef,
    organizationId,
    referenceData,
    referenceDataRef,
    saveNow,
    t,
  })
  const openNodeOutputInspector = useCallback((nodeId: string) => {
    setSelectedIds([nodeId])
    requestAnimationFrame(() => {
      document.getElementById(`flow-node-connections-${nodeId}`)?.focus()
    })
  }, [setSelectedIds])
  const handleCanvasKeyDown = useCallback((
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      (!event.metaKey && !event.ctrlKey)
      || event.altKey
      || isEditableCanvasTarget(event.target)
    ) {
      return
    }

    const key = event.key.toLowerCase()
    if (key === 'd') {
      if (selectedNodeIds.length === 0)
        return
      event.preventDefault()
      duplicateNodes(selectedNodeIds)
      return
    }
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey)
        redo()
      else
        undo()
      return
    }
    if (key === 'y' && !event.shiftKey) {
      event.preventDefault()
      redo()
    }
  }, [duplicateNodes, redo, selectedNodeIds, undo])
  const handleCanvasPointerDown = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isEditableCanvasTarget(event.target))
      event.currentTarget.focus({ preventScroll: true })
  }, [])
  const ariaLabelConfig = useMemo(() => ({
    'node.a11yDescription.default': t('flows.a11y.nodeDescription'),
  }), [t])
  const defaultViewport = useMemo(() => ({
    x: flow.viewport.x,
    y: flow.viewport.y,
    zoom: flow.viewport.zoom,
  }), [flow.viewport.x, flow.viewport.y, flow.viewport.zoom])
  const handleMoveEnd = useCallback((
    _event: MouseEvent | TouchEvent | null,
    viewport: Viewport,
  ) => {
    persistViewport(viewport)
  }, [persistViewport])
  const handleNodeDragStop = useCallback(() => markDirty(), [markDirty])
  const focusSelection = useCallback((nodeIds: string[], edgeIds: string[]) => {
    const focusNodeIds = new Set(nodeIds)
    const selectedEdgeIds = new Set(edgeIds)
    for (const edge of edgesRef.current) {
      if (!selectedEdgeIds.has(edge.id))
        continue
      focusNodeIds.add(edge.source)
      focusNodeIds.add(edge.target)
    }
    const focusNodes = nodesRef.current.filter(node => focusNodeIds.has(node.id))
    if (focusNodes.length === 0)
      return
    void reactFlow.fitView({
      duration: 300,
      nodes: focusNodes,
      padding: 0.2,
    })
  }, [edgesRef, nodesRef, reactFlow])
  const contextValue = useFlowCanvasContextValue({
    deleteNodes,
    duplicateNodes,
    editingImageCropNodeId,
    generationConfig,
    getAssetUpload: assetUploads.getUpload,
    getExecutableInputCount,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    getIncompatibleGenerationEdgeCount,
    getIncompatibleGenerationEdges,
    getInputState,
    getNode,
    openAssetPicker: setAssetPickerNodeId,
    openNodeOutputInspector,
    referenceData,
    isRunAllRunning,
    retryGenerationRun,
    runAll,
    runGenerationPreview,
    setEditingImageCropNodeId,
    updateNodeData,
    updateNodeReference,
    updateGenerationConfiguration,
  })
  const {
    selectedAsset,
    selectedGenerationNode,
    selectedNode,
  } = useFlowCanvasInspector({
    getNode,
    referenceData,
    selectedNodeIds,
  })
  const navigationDialog = createFlowCanvasNavigationDialog({
    blocker,
    saveBeforeLeaving,
    saving: savingBeforeLeave,
    status,
  })
  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0
  const {
    canAddNodeType,
    getCanRunNode,
    hasUnavailableGenerationNode,
  } = useFlowRunAvailability({
    generationConfig,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    nodes,
  })
  const visibleEdges = useFlowVisibleEdges({ edges, nodes, referenceData })

  return (
    <FlowCanvasContext value={contextValue}>
      <FlowMediaPreviewProvider>
        <input
          ref={assetUploads.fileInputRef}
          accept={ACCEPTED_ASSET_MEDIA}
          aria-label={t('assets.uploadFiles')}
          className="sr-only"
          multiple
          tabIndex={-1}
          type="file"
          onChange={(event) => {
            if (event.currentTarget.files?.length)
              assetUploads.uploadFiles(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
        <ContextMenu>
          <ContextMenuTrigger
            className={cn(
              `relative size-full overflow-hidden bg-background outline-none`,
              debugMode && 'ring-2 ring-warning/70 ring-inset',
            )}
            render={(
              <div
                ref={wrapperRef}
                tabIndex={-1}
                onKeyDown={handleCanvasKeyDown}
                onPointerDownCapture={handleCanvasPointerDown}
              />
            )}
          >
            <ReactFlow
              aria-label={t('flows.a11y.canvas')}
              ariaLabelConfig={ariaLabelConfig}
              defaultEdgeOptions={FLOW_CANVAS_DEFAULT_EDGE_OPTIONS}
              defaultViewport={defaultViewport}
              deleteKeyCode={FLOW_CANVAS_DELETE_KEY_CODE}
              edgeTypes={FLOW_CANVAS_EDGE_TYPES}
              edges={visibleEdges}
              fitView={graph.nodes.length === 0}
              isValidConnection={isValidConnection}
              maxZoom={2}
              minZoom={0.15}
              nodes={nodes}
              nodeTypes={FLOW_REACT_NODE_TYPES}
              proOptions={FLOW_CANVAS_PRO_OPTIONS}
              reconnectRadius={14}
              snapGrid={FLOW_CANVAS_SNAP_GRID}
              snapToGrid
              onConnect={onConnect}
              onEdgeContextMenu={handleEdgeContextMenu}
              onEdgesChange={onEdgesChange}
              onMoveEnd={handleMoveEnd}
              onNodeContextMenu={handleNodeContextMenu}
              onNodeDoubleClick={handleNodeDoubleClick}
              onNodeDragStop={handleNodeDragStop}
              onNodesChange={onNodesChange}
              onPaneContextMenu={handlePaneContextMenu}
              onReconnect={onReconnect}
              onSelectionChange={handleSelectionChange}
              onSelectionContextMenu={handleSelectionContextMenu}
            >
              <Background color="var(--flow-dot)" gap={20} size={1.4} variant={BackgroundVariant.Dots} />
              <Controls
                position="bottom-left"
                showInteractive={false}
                aria-label={t('flows.a11y.controls')}
              />
              <MiniMap
                ariaLabel={t('flows.a11y.minimap')}
                className="rounded-xl! border! bg-card/92! shadow-lg!"
                maskColor="color-mix(in oklab, var(--background) 75%, transparent)"
                nodeColor="var(--muted-foreground)"
                pannable
                position="bottom-right"
                zoomable
              />
              <Panel className="m-4!" position="top-left">
                <FlowCanvasHeader
                  canRedo={canRedo}
                  canUndo={canUndo}
                  flow={flow}
                  onFlowDeleted={() => {
                    allowNavigationRef.current = true
                  }}
                  onRedo={redo}
                  onUndo={undo}
                />
              </Panel>
              {debugMode && (
                <Panel className="m-4!" position="top-center">
                  <FlowCanvasDebugIndicator />
                </Panel>
              )}
              {selectedNode && (
                <Panel className="m-5!" position="top-right">
                  <FlowCanvasInspectorPanel
                    edges={edges}
                    selectedAsset={selectedAsset}
                    selectedGenerationNode={selectedGenerationNode}
                    selectedNode={selectedNode}
                  />
                </Panel>
              )}
              <Panel className="m-5!" position="bottom-center">
                <FlowCanvasToolbar
                  canAddNodeType={canAddNodeType}
                  canUseDebugMode={canUseDebugMode}
                  canRedo={canRedo}
                  canUndo={canUndo}
                  debugMode={debugMode}
                  hasSelection={hasSelection}
                  isRunAllRunning={isRunAllRunning}
                  runAllDisabled={isRunAllRunning || hasUnavailableGenerationNode}
                  selectedNodeIds={selectedNodeIds}
                  shortcutLabels={shortcutLabels}
                  status={status}
                  onAddNode={addNode}
                  onDelete={deleteSelection}
                  onDebugModeChange={setDebugMode}
                  onDuplicate={duplicateNodes}
                  onFitView={() => void reactFlow.fitView({
                    duration: 300,
                    padding: 0.2,
                  })}
                  onRedo={redo}
                  onRetrySave={() => void retry()}
                  onRunAll={() => void runAll()}
                  onUndo={undo}
                />
              </Panel>
            </ReactFlow>
          </ContextMenuTrigger>
          <FlowCanvasContextMenuContent
            canAddNodeType={canAddNodeType}
            contextTarget={contextTarget}
            getCanRunNode={getCanRunNode}
            shortcutLabels={shortcutLabels}
            onAddNode={addNode}
            onArrange={autoFormatSelection}
            onDeleteNodeIds={deleteNodes}
            onDeleteSelection={deleteSelection}
            onDuplicate={duplicateNodes}
            onFitView={() => void reactFlow.fitView({
              duration: 300,
              padding: 0.2,
            })}
            onFocus={focusSelection}
            onRunFromHere={nodeId => void runGenerationPreview(nodeId, 'fromHere')}
            onRunNode={nodeId => void runGenerationPreview(nodeId)}
            onRunSelection={nodeIds => void runGenerationSelectionPreview(nodeIds)}
            onRunTillHere={nodeId => void runGenerationPreview(nodeId, 'tillHere')}
            onSelectAll={selectAll}
            onUploadAssets={assetUploads.openFilePicker}
          />
        </ContextMenu>
        <FlowCanvasDialogs
          assetPickerNodeId={assetPickerNodeId}
          navigation={navigationDialog}
          selectedAssetId={assetPickerNodeId
            ? getNode(assetPickerNodeId)?.assetId ?? null
            : null}
          onAssetPickerOpenChange={open => !open && setAssetPickerNodeId(null)}
          onSelectAsset={(asset) => {
            if (assetPickerNodeId)
              updateNodeReference(assetPickerNodeId, { assetId: asset.id })
            setAssetPickerNodeId(null)
          }}
        />
      </FlowMediaPreviewProvider>
    </FlowCanvasContext>
  )
}

/** Renders a provider-backed React Flow canvas for one editable Flow. */
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
