/** Apply/cancel controls for an active local image-crop editing session. */

import type { FlowImageCrop } from '@talelabs/flows'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import { NodeToolbar, Position } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { FlowActionTooltip } from '../toolbars/flow-action-tooltip'
import { isFullImageCrop } from './image-crop'

/** Offers reset, cancel, and apply commands for the active crop draft. */
export function ImageCropToolbar({
  draftCrop,
  nodeId,
  onApply,
  onCancel,
  onReset,
}: {
  draftCrop: FlowImageCrop
  nodeId: string
  onApply: () => void
  onCancel: () => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  const resetDisabled = isFullImageCrop(draftCrop)

  return (
    <NodeToolbar
      className="nodrag nopan flex items-center gap-1 rounded-full p-1"
      data-flow-chrome
      data-flow-chrome-enter
      isVisible
      nodeId={nodeId}
      offset={12}
      position={Position.Bottom}
    >
      <FlowActionTooltip
        disabled={resetDisabled}
        label={t('flows.cropEditor.reset')}
      >
        <Button
          disabled={resetDisabled}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => {
            onReset()
          }}
        >
          {t('flows.cropEditor.reset')}
        </Button>
      </FlowActionTooltip>
      <Separator className="mx-0.5 h-5! self-center!" orientation="vertical" />
      <Button
        size="sm"
        type="button"
        variant="ghost"
        onClick={onCancel}
      >
        {t('common.cancel')}
      </Button>
      <Button size="sm" type="button" onClick={onApply}>
        {t('flows.cropEditor.apply')}
      </Button>
    </NodeToolbar>
  )
}
