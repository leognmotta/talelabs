/** Zoom-out, reset, and zoom-in cluster driven by the live viewport transform. */

import { IconMinus, IconPlus } from '@tabler/icons-react'
import { useReactFlow, useStore } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { FlowActionTooltip } from '../nodes/shared/toolbars/flow-action-tooltip'
import { FlowToolbarButton } from '../nodes/shared/toolbars/flow-toolbar-button'

/** Reads the current zoom percent and exposes stepper and reset viewport commands. */
export function FlowCanvasZoomControls() {
  const { t } = useTranslation()
  const reactFlow = useReactFlow()
  const zoomPercent = useStore(state => Math.round(state.transform[2] * 100))
  const resetLabel = t('flows.zoomReset')

  return (
    <div className="flex items-center gap-0.5" data-flow-zoom-controls>
      <FlowToolbarButton
        icon={IconMinus}
        label={t('flows.zoomOut')}
        onClick={() => void reactFlow.zoomOut({ duration: 200 })}
      />
      <FlowActionTooltip label={resetLabel}>
        <button
          aria-label={resetLabel}
          className="
            h-8 min-w-11 rounded-md px-1 text-center text-xs font-medium
            text-muted-foreground tabular-nums
            hover:bg-accent hover:text-accent-foreground
          "
          type="button"
          onClick={() => void reactFlow.zoomTo(1, { duration: 200 })}
        >
          {`${zoomPercent}%`}
        </button>
      </FlowActionTooltip>
      <FlowToolbarButton
        icon={IconPlus}
        label={t('flows.zoomIn')}
        onClick={() => void reactFlow.zoomIn({ duration: 200 })}
      />
    </div>
  )
}
