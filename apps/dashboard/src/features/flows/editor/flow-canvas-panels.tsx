/** React Flow panels with isolated selectors for header, inspector, and toolbar. */

import type { FlowNodeType } from '@talelabs/flows'
import type { Flow } from '@talelabs/sdk'
import type { CanvasNode, FlowSaveStatus } from './flow-canvas-types'

import { Panel } from '@xyflow/react'
import { memo, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getFlowDashboardNodeDefinition } from '../nodes/flow-dashboard-node-registry'
import { restoreCanvasHistory } from './canvas-state/canvas-history-actions'
import { useCanvasStore, useCanvasStoreApi } from './canvas-state/canvas-store-context'
import { FlowCanvasHeader } from './flow-canvas-header'
import { FlowCanvasInspectorPanel } from './flow-canvas-inspector-panel'
import { useFlowCanvasRuntime } from './flow-canvas-runtime-context'
import { FlowCanvasToolbar } from './flow-canvas-toolbar'

const INSPECTOR_POSITION = { x: 0, y: 0 }

/** Renders history-aware Flow navigation without observing graph collections. */
export const FlowCanvasHeaderPanel = memo((input: {
  flow: Flow
  status: FlowSaveStatus
  onFlowDeleted: () => void
  onRetrySave: () => void
}) => {
  const store = useCanvasStoreApi()
  const canUndo = useCanvasStore(state => state.past.length > 0)
  const canRedo = useCanvasStore(state => state.future.length > 0)
  return (
    <Panel className="m-4!" position="top-left">
      <FlowCanvasHeader
        canRedo={canRedo}
        canUndo={canUndo}
        flow={input.flow}
        saveStatus={input.status}
        onFlowDeleted={input.onFlowDeleted}
        onRedo={() => restoreCanvasHistory(store, 'redo')}
        onRetrySave={input.onRetrySave}
        onUndo={() => restoreCanvasHistory(store, 'undo')}
      />
    </Panel>
  )
})

/** Renders the selected node inspector without observing node positions. */
export const FlowCanvasInspectorPanelSlot = memo(() => {
  const runtime = useFlowCanvasRuntime()
  const edges = useCanvasStore(state => state.edges)
  const selectedNode = useCanvasStore(useShallow((state): CanvasNode | undefined => {
    if (state.selectedNodeIds.length !== 1)
      return undefined
    const node = state.nodes.find(candidate => candidate.id === state.selectedNodeIds[0])
    return node
      ? {
          assetId: node.assetId,
          data: node.data,
          id: node.id,
          position: INSPECTOR_POSITION,
          schemaVersion: node.schemaVersion,
          type: node.type,
        }
      : undefined
  }))
  const definition = selectedNode
    ? getFlowDashboardNodeDefinition(selectedNode.type)
    : undefined
  const selectedAsset = useMemo(() => (
    definition?.inspector === 'assetMetadata' && selectedNode?.assetId
      ? runtime.referenceData.assetsById.get(selectedNode.assetId)
      : undefined
  ), [definition?.inspector, runtime.referenceData.assetsById, selectedNode?.assetId])
  const selectedGenerationNode = definition?.inspector === 'generationSettings'
    ? selectedNode
    : undefined
  if (!selectedNode)
    return null
  return (
    <Panel className="m-5!" position="top-right">
      <div data-flow-chrome-enter key={selectedNode.id}>
        <FlowCanvasInspectorPanel
          edges={edges}
          selectedAsset={selectedAsset}
          selectedGenerationNode={selectedGenerationNode}
          selectedNode={selectedNode}
        />
      </div>
    </Panel>
  )
})

/** Renders canvas commands from history and scalar UI state only. */
export const FlowCanvasToolbarPanel = memo((input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  canUseDebugMode: boolean
  debugMode: boolean
  onAddNode: (nodeType: FlowNodeType) => void
  onDebugModeChange: (enabled: boolean) => void
  onFitView: () => void
  shortcutLabels: Readonly<{
    redo: string
    undo: string
  }>
}) => {
  const store = useCanvasStoreApi()
  const canUndo = useCanvasStore(state => state.past.length > 0)
  const canRedo = useCanvasStore(state => state.future.length > 0)
  return (
    <Panel className="m-5!" position="bottom-center">
      <FlowCanvasToolbar
        canAddNodeType={input.canAddNodeType}
        canRedo={canRedo}
        canUndo={canUndo}
        canUseDebugMode={input.canUseDebugMode}
        debugMode={input.debugMode}
        shortcutLabels={input.shortcutLabels}
        onAddNode={input.onAddNode}
        onDebugModeChange={input.onDebugModeChange}
        onFitView={input.onFitView}
        onRedo={() => restoreCanvasHistory(store, 'redo')}
        onUndo={() => restoreCanvasHistory(store, 'undo')}
      />
    </Panel>
  )
})
