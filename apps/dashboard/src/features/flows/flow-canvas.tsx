import type { FlowValueType } from '@talelabs/flows'
import type {
  Flow,
  FlowGraphReferences,
  FlowGraphResponse,
  GenerationConfigResponse,
} from '@talelabs/sdk'
import type { Viewport } from '@xyflow/react'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
import {
  IconCopy,
  IconFocusCentered,
  IconHierarchy3,
  IconPlus,
  IconRefresh,
  IconSelectAll,
  IconTrash,
} from '@tabler/icons-react'
import { getFlowNodeHandles, isFlowNodeType } from '@talelabs/flows'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@talelabs/ui/components/context-menu'
import { Spinner } from '@talelabs/ui/components/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
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
import { FlowAssetMetadataCard } from './flow-asset-metadata-card'
import { FlowCanvasContext } from './flow-canvas-context'
import { FlowCanvasDialogs } from './flow-canvas-dialogs'
import {
  canvasNodeToGraphNode,
  toCanvasEdges,
  toCanvasNodes,
} from './flow-canvas-serialization'
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
import { useFlowAutosave } from './use-flow-autosave'
import { useFlowCanvasController } from './use-flow-canvas-controller'
import { useFlowCanvasSelection } from './use-flow-canvas-selection'
import { useFlowReferenceData } from './use-flow-reference-data'
import { useFlowViewportPersistence } from './use-flow-viewport-persistence'
import '@xyflow/react/dist/style.css'

const DEFAULT_EDGE_OPTIONS = {
  animated: false,
  style: { strokeWidth: 1.75 },
}
const DELETE_KEY_CODE = ['Backspace', 'Delete']
const REACT_FLOW_PRO_OPTIONS = { hideAttribution: true }
const SNAP_GRID: [number, number] = [16, 16]
const FLOW_VALUE_COLORS = {
  Asset: 'var(--flow-type-asset)',
  AudioSet: 'var(--flow-type-audio)',
  ElementContext: 'var(--flow-type-context)',
  ImageSet: 'var(--flow-type-image)',
  Text: 'var(--flow-type-text)',
  VideoSet: 'var(--flow-type-video)',
} as const satisfies Record<FlowValueType, string>

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
  const { t } = useTranslation()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const reactFlow = useReactFlow<CanvasNode, CanvasEdge>()
  const [nodes, setNodes] = useNodesState<CanvasNode>(toCanvasNodes(graph.nodes))
  const [edges, setEdges] = useEdgesState<CanvasEdge>(toCanvasEdges(graph.edges))
  const [assetPickerNodeId, setAssetPickerNodeId] = useState<null | string>(null)
  const [elementPickerNodeId, setElementPickerNodeId] = useState<null | string>(null)
  const [editingImageCropNodeId, setEditingImageCropNodeId] = useState<null | string>(null)
  const [inspector, setInspector] = useState<null | { nodeId: string, slotId: string }>(null)
  const referenceData = useFlowReferenceData(references)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const referenceDataRef = useRef(referenceData)
  nodesRef.current = nodes
  edgesRef.current = edges
  referenceDataRef.current = referenceData
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
    setNodes(nextNodes)
    setEdges(nextEdges)
  }, [setEdges, setNodes])
  const autosave = useFlowAutosave({
    edges,
    flowId: flow.id,
    initialGraph: graph,
    nodes,
    organizationId,
    replaceGraph,
  })
  const { markDirty, retry, saveNow, status } = autosave
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    autosave.dirty
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
    if (saved && blocker.state === 'blocked')
      blocker.proceed()
  }, [blocker, saveNow])

  const controller = useFlowCanvasController({
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
  const contextValue = useMemo(() => ({
    deleteNodes,
    duplicateNodes,
    editingImageCropNodeId,
    generationConfig,
    getIncompatibleGenerationEdgeCount,
    getInputState,
    getNode,
    openAssetPicker: setAssetPickerNodeId,
    openElementPicker: setElementPickerNodeId,
    openInputInspector: (nodeId: string, slotId: string) => setInspector({ nodeId, slotId }),
    referenceData,
    setEditingImageCropNodeId,
    setInputSelection,
    updateNodeData,
    updateNodeReference,
    updateGenerationConfiguration,
  }), [
    deleteNodes,
    duplicateNodes,
    editingImageCropNodeId,
    generationConfig,
    getIncompatibleGenerationEdgeCount,
    getInputState,
    getNode,
    referenceData,
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
        <ContextMenu>
          <ContextMenuTrigger
            className="relative size-full overflow-hidden bg-background"
            render={<div ref={wrapperRef} />}
          >
            <ReactFlow
              aria-label={t('flows.a11y.canvas')}
              ariaLabelConfig={ariaLabelConfig}
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              defaultViewport={defaultViewport}
              deleteKeyCode={DELETE_KEY_CODE}
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
              <Background color="var(--flow-dot)" gap={20} size={1.1} variant={BackgroundVariant.Dots} />
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
                  <Tooltip>
                    <TooltipTrigger render={<Button aria-label={t('flows.fitView')} size="icon-sm" variant="ghost" onClick={() => void reactFlow.fitView({ duration: 300, padding: 0.2 })} />}>
                      <IconFocusCentered />
                    </TooltipTrigger>
                    <TooltipContent>{t('flows.fitView')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button aria-label={t('flows.duplicateSelection')} disabled={selectedNodeIds.length === 0} size="icon-sm" variant="ghost" onClick={() => duplicateNodes(selectedNodeIds)} />}>
                      <IconCopy />
                    </TooltipTrigger>
                    <TooltipContent>{t('flows.duplicateSelection')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger render={<Button aria-label={t('flows.deleteSelection')} disabled={!hasSelection} size="icon-sm" variant="ghost" onClick={deleteSelection} />}>
                      <IconTrash />
                    </TooltipTrigger>
                    <TooltipContent>{t('flows.deleteSelection')}</TooltipContent>
                  </Tooltip>
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
          <ContextMenuContent>
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
                      </ContextMenuItem>
                    </ContextMenuGroup>
                  </>
                )
              : contextTarget.nodeIds.length > 0 || contextTarget.edgeIds.length > 0
                ? (
                    <>
                      <ContextMenuGroup>
                        <ContextMenuItem
                          disabled={contextTarget.nodeIds.length < 2}
                          onClick={() => autoFormatSelection(contextTarget.nodeIds)}
                        >
                          <IconHierarchy3 />
                          {t('flows.autoFormat')}
                        </ContextMenuItem>
                        <ContextMenuItem
                          disabled={contextTarget.nodeIds.length === 0}
                          onClick={() => duplicateNodes(contextTarget.nodeIds)}
                        >
                          <IconCopy />
                          {t('flows.duplicateSelection')}
                        </ContextMenuItem>
                      </ContextMenuGroup>
                      <ContextMenuSeparator />
                      <ContextMenuGroup>
                        <ContextMenuItem
                          variant="destructive"
                          onClick={deleteSelection}
                        >
                          <IconTrash />
                          {t('flows.deleteSelection')}
                        </ContextMenuItem>
                      </ContextMenuGroup>
                    </>
                  )
                : (
                    <ContextMenuGroup>
                      <ContextMenuItem onClick={selectAll}>
                        <IconSelectAll />
                        {t('flows.selectAll')}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => void reactFlow.fitView({ duration: 300, padding: 0.2 })}>
                        <IconFocusCentered />
                        {t('flows.fitView')}
                      </ContextMenuItem>
                    </ContextMenuGroup>
                  )}
          </ContextMenuContent>
        </ContextMenu>
        <FlowCanvasDialogs
          assetPickerNodeId={assetPickerNodeId}
          elementPickerNodeId={elementPickerNodeId}
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
          onElementPickerOpenChange={open => !open && setElementPickerNodeId(null)}
          onInputInspectorOpenChange={open => !open && setInspector(null)}
          onInputSelectionChange={(selection) => {
            if (inspector)
              setInputSelection(inspector.nodeId, inspector.slotId, selection)
          }}
          onSelectAsset={(asset) => {
            if (assetPickerNodeId)
              updateNodeReference(assetPickerNodeId, { assetId: asset.id, elementId: null })
            setAssetPickerNodeId(null)
          }}
          onSelectElement={(element) => {
            if (elementPickerNodeId)
              updateNodeReference(elementPickerNodeId, { assetId: null, elementId: element.id })
            setElementPickerNodeId(null)
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
