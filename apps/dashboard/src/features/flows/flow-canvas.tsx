import type { FlowValueType } from '@talelabs/flows'
import type {
  Flow,
  FlowGraphReferences,
  FlowGraphResponse,
  GenerationConfigResponse,
} from '@talelabs/sdk'
import type { Viewport } from '@xyflow/react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  CanvasEdge,
  CanvasNode,
} from './flow-canvas-types'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCopy,
  IconFocusCentered,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import {
  getFlowNodeHandles,
  isFlowNodeType,
} from '@talelabs/flows'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@talelabs/ui/components/context-menu'
import { Spinner } from '@talelabs/ui/components/spinner'
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
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'
import { toast } from 'sonner'
import { SearchablePicker } from '../../shared/components/searchable-picker'
import { ACCEPTED_ASSET_MEDIA } from '../assets/asset-upload-files'
import { FlowAssetMetadataCard } from './flow-asset-metadata-card'
import { FlowCanvasContext } from './flow-canvas-context'
import { FlowCanvasDialogs } from './flow-canvas-dialogs'
import { FlowCanvasEdge } from './flow-canvas-edge'
import { FlowCanvasHeader } from './flow-canvas-header'
import { FlowCanvasPaneContextMenu } from './flow-canvas-pane-context-menu'
import { FlowCanvasSelectionContextMenu } from './flow-canvas-selection-context-menu'
import {
  canvasNodeToGraphNode,
  toCanvasEdges,
  toCanvasNodes,
} from './flow-canvas-serialization'
import { getFlowCanvasShortcutLabels } from './flow-canvas-shortcuts'
import {
  FLOW_NODE_PICKER_DEFINITIONS,
  FLOW_NODE_PICKER_GROUPS,
  FLOW_REACT_NODE_TYPES,
  getFlowDashboardNodeDefinition,
} from './flow-dashboard-node-registry'
import { getCanvasGenerationModel } from './flow-generation-contract'
import { FlowGenerationSettingsCard } from './flow-generation-settings-card'
import { FlowMediaPreviewProvider } from './flow-media-preview-provider'
import { FlowNodeConnectionsCard } from './flow-node-connections-card'
import { FlowToolbarButton } from './flow-toolbar-button'
import { useFlowAutosave } from './use-flow-autosave'
import { useFlowCanvasAssetUpload } from './use-flow-canvas-asset-upload'
import { useFlowCanvasController } from './use-flow-canvas-controller'
import { useFlowCanvasHistory } from './use-flow-canvas-history'
import { useFlowCanvasSelection } from './use-flow-canvas-selection'
import { useFlowMockRunOrchestration } from './use-flow-mock-run-orchestration'
import { useFlowReferenceData } from './use-flow-reference-data'
import { useFlowViewportPersistence } from './use-flow-viewport-persistence'
import '@xyflow/react/dist/style.css'

const DEFAULT_EDGE_OPTIONS = {
  animated: false,
  style: { strokeWidth: 1.75 },
  type: 'flow',
}
const FLOW_REACT_EDGE_TYPES = { flow: FlowCanvasEdge }
const DELETE_KEY_CODE = ['Backspace', 'Delete']
const REACT_FLOW_PRO_OPTIONS = { hideAttribution: true }
const SNAP_GRID: [number, number] = [16, 16]
const FLOW_VALUE_COLORS = {
  Asset: 'var(--flow-type-asset)',
  AudioSet: 'var(--flow-type-audio)',
  ElementContext: 'var(--flow-type-element)',
  ImageSet: 'var(--flow-type-image)',
  Text: 'var(--flow-type-text)',
  VideoSet: 'var(--flow-type-video)',
} as const satisfies Record<FlowValueType, string>

function isEditableCanvasTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function FlowCanvasInner({
  flow,
  generationConfig,
  graph,
  organizationId,
  references,
}: {
  flow: Flow
  generationConfig: GenerationConfigResponse
  graph: FlowGraphResponse
  organizationId: string
  references: FlowGraphReferences
}) {
  const { i18n, t } = useTranslation()
  const shortcutLabels = getFlowCanvasShortcutLabels()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>()
  const [nodes, setNodes] = useNodesState<CanvasNode>(toCanvasNodes(graph.nodes))
  const [edges, setEdges] = useEdgesState<CanvasEdge>(toCanvasEdges(graph.edges))
  const [assetPickerNodeId, setAssetPickerNodeId] = useState<null | string>(null)
  const [editingImageCropNodeId, setEditingImageCropNodeId] = useState<null | string>(null)
  const [inspector, setInspector] = useState<null | { nodeId: string, slotId: string }>(null)
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
    setInputSelection,
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
  const contextValue = useMemo(() => ({
    deleteNodes,
    duplicateNodes,
    editingImageCropNodeId,
    edges,
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
    openInputInspector: (nodeId: string, slotId: string) => setInspector({ nodeId, slotId }),
    openNodeOutputInspector,
    referenceData,
    isRunAllRunning,
    retryGenerationRun,
    runAll,
    runGenerationPreview,
    setEditingImageCropNodeId,
    setInputSelection,
    updateNodeData,
    updateNodeReference,
    updateGenerationConfiguration,
  }), [
    deleteNodes,
    duplicateNodes,
    editingImageCropNodeId,
    edges,
    generationConfig,
    assetUploads.getUpload,
    getExecutableInputCount,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    getIncompatibleGenerationEdgeCount,
    getIncompatibleGenerationEdges,
    getInputState,
    getNode,
    openNodeOutputInspector,
    referenceData,
    isRunAllRunning,
    retryGenerationRun,
    runAll,
    runGenerationPreview,
    setInputSelection,
    updateNodeData,
    updateNodeReference,
    updateGenerationConfiguration,
  ])

  const inspectorModel = inspector
    ? getCanvasGenerationModel(getNode(inspector.nodeId))
    : undefined
  const inspectorSlot = inspectorModel?.inputSlots.find(slot => slot.id === inspector?.slotId)
  const inspectorState = inspector ? getInputState(inspector.nodeId, inspector.slotId) : null
  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0
  const getCanRunNode = useCallback((nodeId: string) => {
    const previewStatus = getGenerationPreview(nodeId)?.status
    return getGenerationPreviewFingerprint(nodeId) !== null
      && previewStatus !== 'pending'
      && previewStatus !== 'queued'
  }, [getGenerationPreview, getGenerationPreviewFingerprint])
  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1)
      return undefined
    return nodes.find(node => node.id === selectedNodeIds[0])
  }, [nodes, selectedNodeIds])
  const selectedNodeDefinition = selectedNode
    ? getFlowDashboardNodeDefinition(selectedNode.type)
    : undefined
  const selectedAsset = useMemo(() => {
    if (
      selectedNodeDefinition?.inspector !== 'assetMetadata'
      || !selectedNode?.assetId
    ) {
      return undefined
    }
    return referenceData.assetsById.get(selectedNode.assetId)
  }, [referenceData.assetsById, selectedNode, selectedNodeDefinition])
  const selectedGenerationNode = useMemo(() => {
    return selectedNodeDefinition?.inspector === 'generationSettings'
      ? selectedNode
      : undefined
  }, [selectedNode, selectedNodeDefinition])
  const nodePickerGroups = FLOW_NODE_PICKER_GROUPS.map((group, groupIndex) => ({
    id: group.id,
    items: FLOW_NODE_PICKER_DEFINITIONS
      .filter(definition => definition.pickerGroup === group.id)
      .map(({
        descriptionKey,
        icon: Icon,
        labelKey,
        type,
      }) => ({
        content: (
          <>
            <span className="
              flex size-9 shrink-0 items-center justify-center rounded-lg
              bg-muted text-foreground
            "
            >
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">
                {t(labelKey)}
              </span>
              <span className="
                truncate text-xs font-normal text-muted-foreground
              "
              >
                {t(descriptionKey)}
              </span>
            </span>
          </>
        ),
        id: type,
        searchValue: `${t(labelKey)} ${t(descriptionKey)} ${t(group.labelKey)}`,
      })),
    label: t(group.labelKey),
    separatorBefore: groupIndex > 0,
  }))
  const nodesById = useMemo(
    () => new Map(nodes.map(node => [node.id, node])),
    [nodes],
  )
  const visibleEdges = useMemo(() => edges.map((edge) => {
    const sourceNode = nodesById.get(edge.source)
    const sourceHandle = sourceNode
      ? getFlowNodeHandles(canvasNodeToGraphNode(sourceNode), referenceData)
          .find(handle => handle.direction === 'output' && handle.id === edge.sourceHandle)
      : undefined
    const valueType = sourceHandle?.valueTypes[0]
    return {
      ...edge,
      className: 'flow-edge',
      type: 'flow',
      style: {
        ...edge.style,
        stroke: edge.selected
          ? 'var(--flow-edge-selected)'
          : valueType
            ? FLOW_VALUE_COLORS[valueType]
            : 'var(--flow-type-asset)',
        strokeWidth: edge.selected ? 2.25 : 1.75,
      },
    }
  }), [edges, nodesById, referenceData])

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
            className="
              relative size-full overflow-hidden bg-background outline-none
            "
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
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              defaultViewport={defaultViewport}
              deleteKeyCode={DELETE_KEY_CODE}
              edgeTypes={FLOW_REACT_EDGE_TYPES}
              edges={visibleEdges}
              fitView={graph.nodes.length === 0}
              isValidConnection={isValidConnection}
              maxZoom={2}
              minZoom={0.15}
              nodes={nodes}
              nodeTypes={FLOW_REACT_NODE_TYPES}
              proOptions={REACT_FLOW_PRO_OPTIONS}
              reconnectRadius={14}
              snapGrid={SNAP_GRID}
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
              {selectedNode && (
                <Panel className="m-5!" position="top-right">
                  <div className="flex flex-col gap-3">
                    {selectedAsset && (
                      <FlowAssetMetadataCard asset={selectedAsset} />
                    )}
                    {selectedGenerationNode && (
                      <FlowGenerationSettingsCard node={selectedGenerationNode} />
                    )}
                    <FlowNodeConnectionsCard edges={edges} node={selectedNode} />
                  </div>
                </Panel>
              )}
              <Panel className="m-5!" position="bottom-center">
                <div className="
                  flex items-center gap-1 rounded-xl border border-border/90
                  bg-card/95 p-1 shadow-lg backdrop-blur-sm
                "
                >
                  <SearchablePicker
                    ariaLabel={t('flows.addNode')}
                    emptyMessage={t('flows.nodePicker.noResults')}
                    groups={nodePickerGroups}
                    searchAriaLabel={t('flows.nodePicker.searchPlaceholder')}
                    searchPlaceholder={t('flows.nodePicker.searchPlaceholder')}
                    showTriggerChevron={false}
                    showOverflowAffordance
                    side="top"
                    sideOffset={12}
                    trigger={(
                      <Button
                        aria-label={t('flows.addNode')}
                        size="icon-sm"
                        title={t('flows.addNode')}
                        variant="ghost"
                      />
                    )}
                    triggerContent={<IconPlus />}
                    onSelect={(nodeType) => {
                      const definition = isFlowNodeType(nodeType)
                        ? getFlowDashboardNodeDefinition(nodeType)
                        : undefined
                      if (definition?.pickerVisible)
                        addNode(definition.type)
                    }}
                  />
                  <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
                  <FlowToolbarButton
                    disabled={!canUndo}
                    icon={IconArrowBackUp}
                    label={t('flows.undo')}
                    shortcut={shortcutLabels.undo}
                    onClick={undo}
                  />
                  <FlowToolbarButton
                    disabled={!canRedo}
                    icon={IconArrowForwardUp}
                    label={t('flows.redo')}
                    shortcut={shortcutLabels.redo}
                    onClick={redo}
                  />
                  <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
                  <FlowToolbarButton
                    icon={IconFocusCentered}
                    label={t('flows.fitView')}
                    onClick={() => void reactFlow.fitView({
                      duration: 300,
                      padding: 0.2,
                    })}
                  />
                  <FlowToolbarButton
                    disabled={selectedNodeIds.length === 0}
                    icon={IconCopy}
                    label={t('flows.duplicateSelection')}
                    shortcut={shortcutLabels.duplicate}
                    onClick={() => duplicateNodes(selectedNodeIds)}
                  />
                  <FlowToolbarButton
                    disabled={!hasSelection}
                    icon={IconTrash}
                    label={t('flows.deleteSelection')}
                    shortcut={shortcutLabels.delete}
                    onClick={deleteSelection}
                  />
                  <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
                  <FlowToolbarButton
                    disabled={isRunAllRunning}
                    icon={IconPlayerPlay}
                    label={t('flows.runAll')}
                    loading={isRunAllRunning}
                    onClick={() => void runAll()}
                  />
                  {status === 'conflict' && (
                    <>
                      <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
                      <Badge variant="secondary">
                        <Spinner data-icon="inline-start" />
                        {t('flows.saveStatus.conflict')}
                      </Badge>
                    </>
                  )}
                  {status === 'error' && (
                    <>
                      <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void retry()}
                      >
                        <IconRefresh data-icon="inline-start" />
                        {t('flows.saveStatus.error')}
                      </Button>
                    </>
                  )}
                </div>
              </Panel>
            </ReactFlow>
          </ContextMenuTrigger>
          <ContextMenuContent
            className={contextTarget.mode === 'pane'
              ? 'max-h-[70vh] w-64'
              : undefined}
            showOverflowAffordance={contextTarget.mode === 'pane'}
          >
            {contextTarget.mode === 'nodeActions'
              && contextTarget.nodeIds.length === 1
              ? (
                  <>
                    <ContextMenuGroup>
                      <ContextMenuItem
                        onClick={() => duplicateNodes(contextTarget.nodeIds)}
                      >
                        <IconCopy />
                        {t('flows.duplicateNode')}
                        <ContextMenuShortcut>
                          {shortcutLabels.duplicate}
                        </ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuGroup>
                    <ContextMenuSeparator />
                    <ContextMenuGroup>
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => deleteNodes(contextTarget.nodeIds)}
                      >
                        <IconTrash />
                        {t('flows.deleteNode')}
                        <ContextMenuShortcut>
                          {shortcutLabels.delete}
                        </ContextMenuShortcut>
                      </ContextMenuItem>
                    </ContextMenuGroup>
                  </>
                )
              : contextTarget.nodeIds.length > 0 || contextTarget.edgeIds.length > 0
                ? (
                    <FlowCanvasSelectionContextMenu
                      canArrange={contextTarget.nodeIds.length >= 2}
                      canDuplicate={contextTarget.nodeIds.length > 0}
                      canFocus={contextTarget.nodeIds.length > 0
                        || contextTarget.edgeIds.length > 0}
                      canRun={contextTarget.nodeIds.some(getCanRunNode)}
                      canRunNode={contextTarget.nodeIds.length === 1
                        ? getCanRunNode(contextTarget.nodeIds[0]!)
                        : false}
                      deleteShortcut={shortcutLabels.delete}
                      duplicateShortcut={shortcutLabels.duplicate}
                      onArrange={() => autoFormatSelection(contextTarget.nodeIds)}
                      onDelete={deleteSelection}
                      onDuplicate={() => duplicateNodes(contextTarget.nodeIds)}
                      onFocus={() => focusSelection(
                        contextTarget.nodeIds,
                        contextTarget.edgeIds,
                      )}
                      onRun={() => void runGenerationSelectionPreview(
                        contextTarget.nodeIds,
                      )}
                      onRunFromHere={contextTarget.nodeIds.length === 1
                        ? () => void runGenerationPreview(contextTarget.nodeIds[0]!, 'fromHere')
                        : undefined}
                      onRunNode={contextTarget.nodeIds.length === 1
                        ? () => void runGenerationPreview(contextTarget.nodeIds[0]!)
                        : undefined}
                      onRunTillHere={contextTarget.nodeIds.length === 1
                        ? () => void runGenerationPreview(contextTarget.nodeIds[0]!, 'tillHere')
                        : undefined}
                    />
                  )
                : (
                    <FlowCanvasPaneContextMenu
                      onAddNode={nodeType => addNode(
                        nodeType,
                        contextTarget.screenPosition ?? undefined,
                      )}
                      onFitView={() => void reactFlow.fitView({
                        duration: 300,
                        padding: 0.2,
                      })}
                      onSelectAll={selectAll}
                      onUploadAssets={() => assetUploads.openFilePicker(
                        contextTarget.screenPosition,
                      )}
                    />
                  )}
          </ContextMenuContent>
        </ContextMenu>
        <FlowCanvasDialogs
          assetPickerNodeId={assetPickerNodeId}
          inputInspector={{
            inputState: inspectorState,
            open: inspector !== null,
            title: inspectorSlot ? t(inspectorSlot.labelKey) : '',
          }}
          navigation={{
            blocked: blocker.state === 'blocked',
            onCancel: () => {
              if (blocker.state === 'blocked')
                blocker.reset()
            },
            onSave: () => void saveBeforeLeaving(),
            saving: savingBeforeLeave,
            status,
          }}
          selectedAssetId={assetPickerNodeId
            ? getNode(assetPickerNodeId)?.assetId ?? null
            : null}
          onAssetPickerOpenChange={open => !open && setAssetPickerNodeId(null)}
          onInputInspectorOpenChange={open => !open && setInspector(null)}
          onInputSelectionChange={(selection) => {
            if (inspector)
              setInputSelection(inspector.nodeId, inspector.slotId, selection)
          }}
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

export function FlowCanvas(props: {
  flow: Flow
  generationConfig: GenerationConfigResponse
  graph: FlowGraphResponse
  organizationId: string
  references: FlowGraphReferences
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
