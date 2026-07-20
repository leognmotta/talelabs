/** Memoized editable text input node backed by scoped canvas state. */

import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../editor/flow-canvas-types'
import { IconTextCaption } from '@tabler/icons-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { updateCanvasNodeData } from '../../editor/canvas-state/canvas-node-actions'
import { useCanvasStoreApi } from '../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../editor/flow-canvas-runtime-context'
import { FlowNodeShell } from '../shared/flow-node-shell'
import { FlowNodeTextarea } from '../shared/flow-node-textarea'
import { FlowNodeOutputFooter } from '../shared/media/flow-node-output-footer'

/** Renders one memoized editable text node. */
export const TextFlowNode = memo(({
  data,
  id,
  selected,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()

  return (
    <FlowNodeShell
      accentValueType="Text"
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
        onChange={event => updateCanvasNodeData({
          referenceData: runtime.referenceData,
          store,
        }, id, current => ({ ...current, text: event.target.value }))}
        onKeyDown={event => event.stopPropagation()}
      />
    </FlowNodeShell>
  )
})
