/** Keyboard, focus, upload, and navigation lifecycle for one Flow canvas. */

import type { Viewport } from '@xyflow/react'
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  SetStateAction,
} from 'react'
import type { useBlocker } from 'react-router'
import type { CanvasStore } from './canvas-state/canvas-store'
import type { FlowSaveStatus } from './flow-canvas-types'

import { useMemo } from 'react'
import { toast } from 'sonner'
import { restoreCanvasHistory } from './canvas-state/canvas-history-actions'
import { duplicateCanvasNodes } from './canvas-state/canvas-node-collection-actions'
import { isEditableCanvasTarget } from './flow-canvas-editable-target'
import {
  allowFlowCanvasNavigation,
  focusFlowCanvasFromPointer,
  uploadFlowCanvasFilesFromInput,
} from './flow-canvas-input-actions'
import { createFlowCanvasNavigationDialog } from './flow-canvas-navigation-dialog'
import {
  createFlowCanvasAriaLabelConfig,
  createFlowCanvasDefaultViewport,
} from './flow-canvas-render-state'

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

async function saveFlowCanvasBeforeLeaving(input: {
  blocker: ReturnType<typeof useBlocker>
  saveNow: () => Promise<null | number>
  setSaving: Dispatch<SetStateAction<boolean>>
}): Promise<void> {
  input.setSaving(true)
  const saved = await input.saveNow()
  input.setSaving(false)
  if (saved !== null && input.blocker.state === 'blocked')
    input.blocker.proceed()
}

/** Returns stable lifecycle callbacks without owning canvas graph state. */
export function useFlowCanvasLifecycle(input: {
  /** Mutable escape hatch used only after successful Flow deletion. */
  allowNavigationRef: { current: boolean }
  /** React Router blocker protecting unsaved graph changes. */
  blocker: ReturnType<typeof useBlocker>
  /** Persisted viewport used to initialize React Flow. */
  defaultViewport: Viewport
  /** Localized accessibility description announced for canvas nodes. */
  nodeDescription: string
  /** Current graph save status presented by the navigation dialog. */
  saveStatus: FlowSaveStatus
  /** Flushes the current graph through revision-based autosave. */
  saveNow: () => Promise<null | number>
  /** Whether the navigation dialog is currently flushing autosave. */
  savingBeforeLeave: boolean
  /** Updates navigation-dialog save progress. */
  setSavingBeforeLeave: Dispatch<SetStateAction<boolean>>
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
    ),
    onViewportSaveError: toast.error.bind(
      null,
      input.viewportSaveFailedMessage,
    ),
    saveBeforeLeaving: saveFlowCanvasBeforeLeaving.bind(null, {
      blocker: input.blocker,
      saveNow: input.saveNow,
      setSaving: input.setSavingBeforeLeave,
    }),
  }), [
    input.allowNavigationRef,
    input.blocker,
    input.saveNow,
    input.setSavingBeforeLeave,
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
  const navigationDialog = useMemo(() => createFlowCanvasNavigationDialog({
    blocker: input.blocker,
    saveBeforeLeaving: callbacks.saveBeforeLeaving,
    saving: input.savingBeforeLeave,
    status: input.saveStatus,
  }), [
    callbacks.saveBeforeLeaving,
    input.blocker,
    input.saveStatus,
    input.savingBeforeLeave,
  ])
  return {
    ...callbacks,
    ariaLabelConfig,
    defaultViewport,
    navigationDialog,
  }
}
