/** DOM input actions for canvas focus, uploads, and navigation permission. */

import type {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import { isEditableCanvasTarget } from './flow-canvas-editable-target'

/** Focuses the canvas when a pointer interaction is not editing a control. */
export function focusFlowCanvasFromPointer(
  event: ReactPointerEvent<HTMLDivElement>,
): void {
  if (!isEditableCanvasTarget(event.target))
    event.currentTarget.focus({ preventScroll: true })
}

/** Uploads selected files and resets the reusable hidden file input. */
export function uploadFlowCanvasFilesFromInput(
  uploadFiles: (files: FileList) => void,
  /** Hidden file-input change event. */
  event: ChangeEvent<HTMLInputElement>,
): void {
  if (event.currentTarget.files?.length)
    uploadFiles(event.currentTarget.files)
  event.currentTarget.value = ''
}

/** Allows the next external navigation after the current Flow is deleted. */
export function allowFlowCanvasNavigation(
  allowNavigationRef: { current: boolean },
  discardPendingChanges: () => void,
): void {
  allowNavigationRef.current = true
  discardPendingChanges()
}
