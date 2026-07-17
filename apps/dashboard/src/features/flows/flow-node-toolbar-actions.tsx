/** Shared node-toolbar actions that mutate the scoped canvas graph. */

import type { ReactNode } from 'react'

import { IconTrash } from '@tabler/icons-react'
import { Separator } from '@talelabs/ui/components/separator'
import { useTranslation } from 'react-i18next'
import { deleteCanvasNodes } from './canvas-state/canvas-node-collection-actions'
import { useCanvasStoreApi } from './canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from './flow-canvas-runtime-context'
import { getFlowCanvasShortcutLabels } from './flow-canvas-shortcuts'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Renders shared children, deletion, and separator controls for one node. */
export function FlowNodeToolbarActions({
  children,
  nodeId,
}: {
  children?: ReactNode
  nodeId: string
}) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const shortcutLabels = getFlowCanvasShortcutLabels()

  return (
    <>
      {children}
      <FlowToolbarButton
        icon={IconTrash}
        label={t('flows.deleteNode')}
        shortcut={shortcutLabels.delete}
        onClick={() => deleteCanvasNodes({
          referenceData: runtime.referenceData,
          store,
        }, [nodeId], [])}
      />
      <Separator className="h-5! self-center!" orientation="vertical" />
    </>
  )
}
