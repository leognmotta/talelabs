/** Centered call-to-action shown while a Flow has no nodes. */

import type { FlowNodeType } from '@talelabs/flows'

import { IconPlus } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import { Panel } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from './canvas-state/canvas-store-context'
import { FlowCanvasNodePicker } from './interactions/flow-canvas-node-picker'

/** Renders the first-node guidance and add-node CTA on an empty canvas. */
export const FlowCanvasEmptyState = memo((input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  onAddNode: (nodeType: FlowNodeType) => void
}) => {
  const { t } = useTranslation()
  const isEmpty = useCanvasStore(state => state.nodes.length === 0)

  if (!isEmpty)
    return null

  return (
    <Panel
      className="pointer-events-none inset-0! flex items-center justify-center"
      position="top-center"
    >
      <div
        className="pointer-events-auto max-w-md px-6 text-center"
        data-flow-chrome-enter
      >
        <Empty className="bg-transparent">
          <EmptyHeader>
            <EmptyTitle>{t('flows.emptyCanvas.title')}</EmptyTitle>
            <EmptyDescription>
              {t('flows.emptyCanvas.description')}
            </EmptyDescription>
          </EmptyHeader>
          <FlowCanvasNodePicker
            canAddNodeType={input.canAddNodeType}
            trigger={(
              <Button type="button">
                {t('flows.addNode')}
              </Button>
            )}
            triggerContent={<IconPlus data-icon="inline-start" />}
            onAddNode={input.onAddNode}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {t('flows.emptyCanvas.hint')}
          </p>
        </Empty>
      </div>
    </Panel>
  )
})
