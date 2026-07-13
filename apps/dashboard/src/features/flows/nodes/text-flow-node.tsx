import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */
import { IconTextCaption } from '@tabler/icons-react'
import { Textarea } from '@talelabs/ui/components/textarea'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from '../flow-canvas-context'
import { FlowHandle } from './flow-handle'
import { FlowNodeShell } from './flow-node-shell'

export const TextFlowNode = memo(({
  data,
  id,
  selected,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()

  return (
    <FlowNodeShell
      className="w-90"
      footer={(
        <div className="
          relative flex w-full items-center justify-between gap-3 text-[11px]
          text-muted-foreground
        "
        >
          <span>
            {t('flows.characterCount', {
              count: typeof data.text === 'string' ? data.text.length : 0,
            })}
          </span>
          <div className="relative flex items-center gap-2">
            <span>{t('flows.outputs.text')}</span>
            <FlowHandle
              ariaLabel={t('flows.handles.textOutput')}
              id="text"
              side="output"
              valueType="Text"
            />
          </div>
        </div>
      )}
      icon={IconTextCaption}
      nodeId={id}
      selected={selected}
      title={t('flows.nodes.text')}
    >
      <Textarea
        aria-label={t('flows.textContent')}
        className="
          nodrag nopan nowheel min-h-36 resize-none rounded-md border-0
          bg-transparent p-0 text-xs/relaxed shadow-none
          focus-visible:border-transparent focus-visible:ring-0
          dark:bg-transparent
        "
        maxLength={16_000}
        placeholder={t('flows.textPlaceholder')}
        value={typeof data.text === 'string' ? data.text : ''}
        onChange={event => canvas.updateNodeData(id, current => ({
          ...current,
          text: event.target.value,
        }))}
        onKeyDown={event => event.stopPropagation()}
      />
    </FlowNodeShell>
  )
})
