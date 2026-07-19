/** Memoized context-menu and dialog overlays for one Flow canvas. */

import type { FlowNodeType } from '@talelabs/flows'
import type { Asset } from '@talelabs/sdk'
import type { ElementNodePick } from '../../elements/element-node-picker-dialog'

import { memo, useCallback } from 'react'
import {
  updateCanvasNodeData,
  updateCanvasNodeReference,
} from './canvas-state/canvas-node-actions'
import { useCanvasStore, useCanvasStoreApi } from './canvas-state/canvas-store-context'
import { FlowCanvasDialogs } from './flow-canvas-dialogs'
import { useFlowCanvasRuntime } from './flow-canvas-runtime-context'
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
  const runtime = useFlowCanvasRuntime()
  const contextTarget = useCanvasStore(state => state.contextTarget)
  const assetPickerNodeId = useCanvasStore(state => state.assetPickerNodeId)
  const elementPickerNodeId = useCanvasStore(state => state.elementPickerNodeId)
  const selectedAssetId = useCanvasStore((state) => {
    if (!state.assetPickerNodeId)
      return null
    return state.nodes.find(node => node.id === state.assetPickerNodeId)?.assetId
      ?? null
  })
  const selectedElementId = useCanvasStore((state) => {
    if (!state.elementPickerNodeId)
      return null
    const data = state.nodes.find(
      node => node.id === state.elementPickerNodeId,
    )?.data
    return typeof data?.elementId === 'string' ? data.elementId : null
  })
  const elementSelectedAssetIds = useCanvasStore((state) => {
    if (!state.elementPickerNodeId)
      return null
    const value = state.nodes.find(
      node => node.id === state.elementPickerNodeId,
    )?.data.selectedAssetIds
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
          .join(' ')
      : null
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
  const closeElementPicker = useCallback((open: boolean) => {
    if (!open)
      store.setState({ elementPickerNodeId: null })
  }, [store])
  const confirmElement = useCallback((pick: ElementNodePick) => {
    const nodeId = store.getState().elementPickerNodeId
    if (nodeId) {
      // Server reference hydration may not include this Element until the
      // graph autosaves and refetches; bridge it so the node renders now.
      store.setState({
        transientElementData: {
          ...store.getState().transientElementData,
          [pick.elementId]: {
            assets: pick.references.map(reference => ({
              id: reference.id,
              name: reference.name,
              type: reference.type,
              source: 'upload' as const,
              visibility: 'private' as const,
              mimeType: reference.mimeType,
              sizeBytes: null,
              width: reference.width,
              height: reference.height,
              durationSeconds: null,
              lifecycle: reference.lifecycle,
              processingState: reference.processingState,
              processingError: null,
              url: reference.url,
              thumbnailUrl: reference.thumbnailUrl,
              createdAt: reference.createdAt,
              generationModel: null,
            })),
            element: {
              id: pick.element.id,
              kind: pick.element.kind,
              name: pick.element.name,
              referenceAssetIds: pick.references
                .map(reference => reference.id),
            },
          },
        },
      })
      updateCanvasNodeData(
        { referenceData: runtime.referenceData, store },
        nodeId,
        data => ({
          ...data,
          elementId: pick.elementId,
          selectedAssetIds: pick.selectedAssetIds,
        }),
      )
    }
    store.setState({ elementPickerNodeId: null })
  }, [runtime.referenceData, store])

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
        elementPickerNodeId={elementPickerNodeId}
        elementSelectedAssetIds={elementSelectedAssetIds === null
          ? null
          : elementSelectedAssetIds === ''
            ? []
            : elementSelectedAssetIds.split(' ')}
        selectedAssetId={selectedAssetId}
        selectedElementId={selectedElementId}
        onAssetPickerOpenChange={closeAssetPicker}
        onConfirmElement={confirmElement}
        onElementPickerOpenChange={closeElementPicker}
        onSelectAsset={selectAsset}
      />
    </>
  )
})
