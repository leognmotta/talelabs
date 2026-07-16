import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../flow-canvas-types'
import { IconTextCaption } from '@tabler/icons-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from '../flow-canvas-context'
import { FlowNodeOutputFooter } from './flow-node-output-footer'
import { FlowNodeShell } from './flow-node-shell'
import { FlowNodeTextarea } from './flow-node-textarea'

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
        <FlowNodeOutputFooter
          ariaLabel={t('flows.handles.output', {
            output: t('flows.inputs.prompt'),
          })}
          handleId="text"
          label={t('flows.inputs.prompt')}
          valueType="Text"
        >
          <span>
            {t('flows.characterCount', {
              count: typeof data.text === 'string' ? data.text.length : 0,
            })}
          </span>
        </FlowNodeOutputFooter>
      )}
      icon={IconTextCaption}
      nodeId={id}
      selected={selected}
      title={t('flows.nodes.text')}
    >
      <FlowNodeTextarea
        aria-label={t('flows.textContent')}
        className="
          min-h-36 resize-none rounded-md border-0 bg-transparent p-0
          text-xs/relaxed shadow-none
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
