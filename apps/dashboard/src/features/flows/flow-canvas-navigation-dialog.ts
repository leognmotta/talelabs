import type { useBlocker } from 'react-router'
import type { FlowCanvasNavigationDialogState } from './flow-canvas-dialogs'

interface CreateFlowCanvasNavigationDialogOptions {
  blocker: ReturnType<typeof useBlocker>
  saveBeforeLeaving: () => Promise<void>
  saving: boolean
  status: FlowCanvasNavigationDialogState['status']
}

export function createFlowCanvasNavigationDialog({
  blocker,
  saveBeforeLeaving,
  saving,
  status,
}: CreateFlowCanvasNavigationDialogOptions): FlowCanvasNavigationDialogState {
  const onCancel = () => {
    if (blocker.state === 'blocked')
      blocker.reset()
  }
  const onSave = () => void saveBeforeLeaving()

  return {
    blocked: blocker.state === 'blocked',
    onCancel,
    onSave,
    saving,
    status,
  }
}
