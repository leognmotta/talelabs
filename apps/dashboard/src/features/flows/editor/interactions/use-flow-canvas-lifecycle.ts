/** Keyboard, focus, upload, and navigation lifecycle for one Flow canvas. */

import type { Viewport } from '@xyflow/react'
import type {
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import type { CanvasStore } from '../canvas-state/canvas-store'

import { useMemo } from 'react'
import { toast } from 'sonner'
import { restoreCanvasHistory } from '../canvas-state/canvas-history-actions'
import { duplicateCanvasNodes } from '../canvas-state/canvas-node-collection-actions'
import {
  createFlowCanvasAriaLabelConfig,
  createFlowCanvasDefaultViewport,
} from '../flow-canvas-render-state'
import { isEditableCanvasTarget } from './flow-canvas-editable-target'
import {
  allowFlowCanvasNavigation,
  focusFlowCanvasFromPointer,
  uploadFlowCanvasFilesFromInput,
} from './flow-canvas-input-actions'

function handleFlowCanvasKeyDown(
  store: CanvasStore,
  event: ReactKeyboardEvent<HTMLDivElement>,
): void {
  if (
    (!event.metaKey && !event.ctrlKey)
    || event.altKey
    || isEditableCanvasTarget(event.target)
  ) {
    return
  }
  const key = event.key.toLowerCase()
  const state = store.getState()
  if (key === 'd' && state.selectedNodeIds.length) {
    event.preventDefault()
    duplicateCanvasNodes(store, state.selectedNodeIds)
  }
  else if (key === 'z') {
    event.preventDefault()
    restoreCanvasHistory(store, event.shiftKey ? 'redo' : 'undo')
  }
  else if (key === 'y' && !event.shiftKey) {
    event.preventDefault()
    restoreCanvasHistory(store, 'redo')
  }
}

/** Returns stable lifecycle callbacks without owning canvas graph state. */
export function useFlowCanvasLifecycle(input: {
  /** Mutable escape hatch used only after successful Flow deletion. */
  allowNavigationRef: { current: boolean }
  /** Persisted viewport used to initialize React Flow. */
  defaultViewport: Viewport
  /** Suppresses a final save after the owning Flow has been deleted. */
  discardPendingChanges: () => void
  /** Localized accessibility description announced for canvas nodes. */
  nodeDescription: string
  /** Scoped client-owned canvas store. */
  store: CanvasStore
  /** Uploads accepted files selected by the hidden canvas input. */
  uploadFiles: (files: File[] | FileList) => void
  /** Localized viewport persistence error. */
  viewportSaveFailedMessage: string
}) {
  const callbacks = useMemo(() => ({
    handleCanvasKeyDown: handleFlowCanvasKeyDown.bind(null, input.store),
    handleCanvasPointerDown: focusFlowCanvasFromPointer,
    handleFileChange: uploadFlowCanvasFilesFromInput.bind(
      null,
      input.uploadFiles,
    ),
    onFlowDeleted: allowFlowCanvasNavigation.bind(
      null,
      input.allowNavigationRef,
      input.discardPendingChanges,
    ),
    onViewportSaveError: toast.error.bind(
      null,
      input.viewportSaveFailedMessage,
    ),
  }), [
    input.allowNavigationRef,
    input.discardPendingChanges,
    input.store,
    input.uploadFiles,
    input.viewportSaveFailedMessage,
  ])
  const ariaLabelConfig = useMemo(
    () => createFlowCanvasAriaLabelConfig(input.nodeDescription),
    [input.nodeDescription],
  )
  const defaultViewportX = input.defaultViewport.x
  const defaultViewportY = input.defaultViewport.y
  const defaultViewportZoom = input.defaultViewport.zoom
  const defaultViewport = useMemo(
    () => createFlowCanvasDefaultViewport({
      x: defaultViewportX,
      y: defaultViewportY,
      zoom: defaultViewportZoom,
    }),
    [defaultViewportX, defaultViewportY, defaultViewportZoom],
  )
  return {
    ...callbacks,
    ariaLabelConfig,
    defaultViewport,
  }
}
