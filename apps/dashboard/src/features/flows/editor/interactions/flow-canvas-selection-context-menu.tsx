/** Context commands for the current node/edge selection snapshot. */

import {
  IconCopy,
  IconFocusCentered,
  IconHierarchy3,
  IconPlayerPlay,
  IconTrash,
} from '@tabler/icons-react'
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@talelabs/ui/components/context-menu'
import { useTranslation } from 'react-i18next'

/** Offers duplicate, lock, and delete commands for the current graph selection. */
export function FlowCanvasSelectionContextMenu({
  canArrange,
  canDuplicate,
  canFocus,
  canRun,
  canRunNode,
  deleteShortcut,
  duplicateShortcut,
  onArrange,
  onDelete,
  onDuplicate,
  onFocus,
  onRun,
  onRunFromHere,
  onRunNode,
  onRunTillHere,
}: {
  canArrange: boolean
  canDuplicate: boolean
  canFocus: boolean
  canRun: boolean
  canRunNode?: boolean
  deleteShortcut: string
  duplicateShortcut: string
  onArrange: () => void
  onDelete: () => void
  onDuplicate: () => void
  onFocus: () => void
  onRun: () => void
  onRunFromHere?: () => void
  onRunNode?: () => void
  onRunTillHere?: () => void
}) {
  const { t } = useTranslation()
  const hasNodeRunActions = Boolean(onRunNode && onRunFromHere && onRunTillHere)

  return (
    <>
      <ContextMenuGroup>
        {hasNodeRunActions
          ? (
              <>
                <ContextMenuItem disabled={!canRunNode} onClick={onRunNode}>
                  <IconPlayerPlay />
                  {t('flows.nodeToolbar.run')}
                </ContextMenuItem>
                <ContextMenuItem disabled={!canRunNode} onClick={onRunFromHere}>
                  <IconPlayerPlay />
                  {t('flows.nodeToolbar.runFromHere')}
                </ContextMenuItem>
                <ContextMenuItem disabled={!canRunNode} onClick={onRunTillHere}>
                  <IconPlayerPlay />
                  {t('flows.nodeToolbar.runTillHere')}
                </ContextMenuItem>
              </>
            )
          : null}
        <ContextMenuItem disabled={!canRun} onClick={onRun}>
          <IconPlayerPlay />
          {t('flows.runSelection')}
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem disabled={!canArrange} onClick={onArrange}>
          <IconHierarchy3 />
          {t('flows.autoFormat')}
        </ContextMenuItem>
        <ContextMenuItem disabled={!canDuplicate} onClick={onDuplicate}>
          <IconCopy />
          {t('flows.duplicateSelection')}
          <ContextMenuShortcut>{duplicateShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!canFocus} onClick={onFocus}>
          <IconFocusCentered />
          {t('flows.focusSelection')}
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <IconTrash />
          {t('flows.deleteSelection')}
          <ContextMenuShortcut>{deleteShortcut}</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
    </>
  )
}
