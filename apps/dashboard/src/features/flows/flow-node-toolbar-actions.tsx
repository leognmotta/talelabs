import type { ReactNode } from 'react'

import { IconTrash } from '@tabler/icons-react'
import { Separator } from '@talelabs/ui/components/separator'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from './flow-canvas-context'
import { getFlowCanvasShortcutLabels } from './flow-canvas-shortcuts'
import { FlowToolbarButton } from './flow-toolbar-button'

export function FlowNodeToolbarActions({
  children,
  nodeId,
}: {
  children?: ReactNode
  nodeId: string
}) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const shortcutLabels = getFlowCanvasShortcutLabels()

  return (
    <>
      {children}
      <FlowToolbarButton
        icon={IconTrash}
        label={t('flows.deleteNode')}
        shortcut={shortcutLabels.delete}
        onClick={() => canvas.deleteNodes([nodeId])}
      />
      <Separator className="h-5! self-center!" orientation="vertical" />
    </>
  )
}
