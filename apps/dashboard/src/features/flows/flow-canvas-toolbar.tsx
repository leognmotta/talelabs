/** Main canvas action bar for graph editing and whole-Flow execution. */

import type { FlowNodeType } from '@talelabs/flows'
import type { FlowSaveStatus } from './flow-canvas-types'

import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBug,
  IconCopy,
  IconFocusCentered,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Spinner } from '@talelabs/ui/components/spinner'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowCanvasNodePicker } from './flow-canvas-node-picker'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Renders canvas editing actions, debug selection, and whole-Flow execution. */
export const FlowCanvasToolbar = memo((input: {
  canAddNodeType: (nodeType: FlowNodeType) => boolean
  canUseDebugMode: boolean
  canRedo: boolean
  canUndo: boolean
  debugMode: boolean
  hasSelection: boolean
  isRunAllRunning: boolean
  runAllDisabled: boolean
  selectedNodeIds: string[]
  shortcutLabels: Readonly<{
    delete: string
    duplicate: string
    redo: string
    undo: string
  }>
  status: FlowSaveStatus
  onAddNode: (nodeType: FlowNodeType) => void
  onDelete: () => void
  onDebugModeChange: (enabled: boolean) => void
  onDuplicate: (nodeIds: string[]) => void
  onFitView: () => void
  onRedo: () => void
  onRetrySave: () => void
  onRunAll: () => void
  onUndo: () => void
}) => {
  const { t } = useTranslation()
  return (
    <div className="
      flex items-center gap-1 rounded-xl border border-border/90 bg-card/95 p-1
      shadow-lg backdrop-blur-sm
    "
    >
      <FlowCanvasNodePicker
        canAddNodeType={input.canAddNodeType}
        onAddNode={input.onAddNode}
      />
      <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
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
      <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
      <FlowToolbarButton
        icon={IconFocusCentered}
        label={t('flows.fitView')}
        onClick={input.onFitView}
      />
      <FlowToolbarButton
        disabled={input.selectedNodeIds.length === 0}
        icon={IconCopy}
        label={t('flows.duplicateSelection')}
        shortcut={input.shortcutLabels.duplicate}
        onClick={() => input.onDuplicate(input.selectedNodeIds)}
      />
      <FlowToolbarButton
        disabled={!input.hasSelection}
        icon={IconTrash}
        label={t('flows.deleteSelection')}
        shortcut={input.shortcutLabels.delete}
        onClick={input.onDelete}
      />
      <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
      {input.canUseDebugMode && (
        <FlowToolbarButton
          icon={IconBug}
          label={input.debugMode
            ? t('flows.debugMode.disable')
            : t('flows.debugMode.enable')}
          pressed={input.debugMode}
          tone="warning"
          onClick={() => input.onDebugModeChange(!input.debugMode)}
        />
      )}
      <FlowToolbarButton
        disabled={input.runAllDisabled}
        icon={IconPlayerPlay}
        label={t('flows.runAll')}
        loading={input.isRunAllRunning}
        onClick={input.onRunAll}
      />
      {input.status === 'conflict' && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
          <Badge variant="secondary">
            <Spinner data-icon="inline-start" />
            {t('flows.saveStatus.conflict')}
          </Badge>
        </>
      )}
      {input.status === 'error' && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px bg-border/80" />
          <Button
            size="sm"
            variant="destructive"
            onClick={input.onRetrySave}
          >
            <IconRefresh data-icon="inline-start" />
            {t('flows.saveStatus.error')}
          </Button>
        </>
      )}
    </div>
  )
})
