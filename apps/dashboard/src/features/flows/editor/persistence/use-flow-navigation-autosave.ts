/** Non-blocking route handoff for dirty Flow canvas revisions. */

import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import {
  createFlowBackgroundSaveKey,
  dispatchFlowBackgroundSave,
} from './flow-background-save-store'
import { shouldBlockFlowCanvasNavigation } from './flow-canvas-navigation-guard'

/** Dispatches the current Zustand graph save and immediately continues navigation. */
export function useFlowNavigationAutosave(input: {
  /** Escape hatch used after the Flow itself has been deleted. */
  allowNavigationRef: { current: boolean }
  /** Whether local graph revisions are not yet acknowledged by the server. */
  dirty: boolean
  /** Flow whose scoped graph is being saved. */
  flowId: string
  /** Organization that owns the Flow. */
  organizationId: string
  /** Existing revision-aware save command for the scoped canvas store. */
  saveNow: () => Promise<null | number>
}): void {
  const blocker = useBlocker(shouldBlockFlowCanvasNavigation.bind(
    null,
    input.allowNavigationRef,
    input.dirty,
  ))

  useEffect(() => {
    if (blocker.state !== 'blocked')
      return

    void dispatchFlowBackgroundSave({
      key: createFlowBackgroundSaveKey(
        input.organizationId,
        input.flowId,
      ),
      save: input.saveNow,
    })
    blocker.proceed()
  }, [
    blocker,
    input.flowId,
    input.organizationId,
    input.saveNow,
  ])
}
