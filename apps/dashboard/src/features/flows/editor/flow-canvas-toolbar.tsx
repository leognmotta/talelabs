/** Main canvas action bar for graph editing controls. */
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import type { FlowNodeType } from '@talelabs/flows'

import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBug,
  IconFocusCentered,
} from '@tabler/icons-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowToolbarButton } from '../nodes/shared/toolbars/flow-toolbar-button'
import { FlowCanvasZoomControls } from './flow-canvas-zoom-controls'
import { FlowCanvasNodePicker } from './interactions/flow-canvas-node-picker'

/** Vertical separator shared between action-bar clusters. */
function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border/60" />
}

/** Renders canvas editing actions and debug selection. */
export const FlowCanvasToolbar = memo((input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  canUseDebugMode: boolean
  canRedo: boolean
  canUndo: boolean
  debugMode: boolean
  shortcutLabels: Readonly<{
    redo: string
    undo: string
  }>
  onAddNode: (nodeType: FlowNodeType) => void
  onDebugModeChange: (enabled: boolean) => void
  onFitView: () => void
  onRedo: () => void
  onUndo: () => void
}) => {
  const { t } = useTranslation()
  return (
    <div
      className="nodrag nopan flex items-center gap-1 rounded-xl p-1"
      data-flow-chrome
    >
      <FlowCanvasNodePicker
        canAddNodeType={input.canAddNodeType}
        onAddNode={input.onAddNode}
      />
      <ToolbarDivider />
      <FlowToolbarButton
        disabled={!input.canUndo}
        icon={IconArrowBackUp}
        label={t('flows.undo')}
        shortcut={input.shortcutLabels.undo}
        onClick={input.onUndo}
      />
      <FlowToolbarButton
        disabled={!input.canRedo}
        icon={IconArrowForwardUp}
        label={t('flows.redo')}
        shortcut={input.shortcutLabels.redo}
        onClick={input.onRedo}
      />
      <ToolbarDivider />
      <FlowCanvasZoomControls />
      <FlowToolbarButton
        icon={IconFocusCentered}
        label={t('flows.fitView')}
        onClick={input.onFitView}
      />
      {input.canUseDebugMode && (
        <>
          <ToolbarDivider />
          <FlowToolbarButton
            icon={IconBug}
            label={input.debugMode
              ? t('flows.debugMode.disable')
              : t('flows.debugMode.enable')}
            pressed={input.debugMode}
            tone="warning"
            onClick={() => input.onDebugModeChange(!input.debugMode)}
          />
        </>
      )}
    </div>
  )
})
