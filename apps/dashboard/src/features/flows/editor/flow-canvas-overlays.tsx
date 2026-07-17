/** Memoized context-menu and dialog overlays for one Flow canvas. */

import type { FlowNodeType } from '@talelabs/flows'
import type { Asset } from '@talelabs/sdk'

import { memo, useCallback } from 'react'
import { updateCanvasNodeReference } from './canvas-state/canvas-node-actions'
import { useCanvasStore, useCanvasStoreApi } from './canvas-state/canvas-store-context'
import { FlowCanvasDialogs } from './flow-canvas-dialogs'
import { FlowCanvasContextMenuContent } from './interactions/flow-canvas-context-menu-content'

/** Renders overlays from narrow UI selectors without observing graph positions. */
export const FlowCanvasOverlays = memo((input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  getCanRunNode: (nodeId: string) => boolean
  onAddNode: (
    nodeType: FlowNodeType,
    position?: { x: number, y: number },
  ) => void
  onArrange: (nodeIds: readonly string[]) => void
  onDeleteNodeIds: (nodeIds: string[]) => void
  onDeleteSelection: () => void
  onDuplicate: (nodeIds: readonly string[]) => void
  onFitView: () => void
  onFocus: (nodeIds: string[], edgeIds: string[]) => void
  onRunFromHere: (nodeId: string) => void
  onRunNode: (nodeId: string) => void
  onRunSelection: (nodeIds: readonly string[]) => void
  onRunTillHere: (nodeId: string) => void
  onSelectAll: () => void
  onUploadAssets: (position: null | { x: number, y: number }) => void
  shortcutLabels: Readonly<{ delete: string, duplicate: string }>
}) => {
  const store = useCanvasStoreApi()
  const contextTarget = useCanvasStore(state => state.contextTarget)
  const assetPickerNodeId = useCanvasStore(state => state.assetPickerNodeId)
  const selectedAssetId = useCanvasStore((state) => {
    if (!state.assetPickerNodeId)
      return null
    return state.nodes.find(node => node.id === state.assetPickerNodeId)?.assetId
      ?? null
  })
  const closeAssetPicker = useCallback((open: boolean) => {
    if (!open)
      store.setState({ assetPickerNodeId: null })
  }, [store])
  const selectAsset = useCallback((asset: Asset) => {
    const nodeId = store.getState().assetPickerNodeId
    if (nodeId)
      updateCanvasNodeReference({ assetId: asset.id, nodeId, store })
    store.setState({ assetPickerNodeId: null })
  }, [store])

  return (
    <>
      <FlowCanvasContextMenuContent
        canAddNodeType={input.canAddNodeType}
        contextTarget={contextTarget}
        getCanRunNode={input.getCanRunNode}
        shortcutLabels={input.shortcutLabels}
        onAddNode={input.onAddNode}
        onArrange={input.onArrange}
        onDeleteNodeIds={input.onDeleteNodeIds}
        onDeleteSelection={input.onDeleteSelection}
        onDuplicate={input.onDuplicate}
        onFitView={input.onFitView}
        onFocus={input.onFocus}
        onRunFromHere={input.onRunFromHere}
        onRunNode={input.onRunNode}
        onRunSelection={input.onRunSelection}
        onRunTillHere={input.onRunTillHere}
        onSelectAll={input.onSelectAll}
        onUploadAssets={input.onUploadAssets}
      />
      <FlowCanvasDialogs
        assetPickerNodeId={assetPickerNodeId}
        selectedAssetId={selectedAssetId}
        onAssetPickerOpenChange={closeAssetPicker}
        onSelectAsset={selectAsset}
      />
    </>
  )
})
