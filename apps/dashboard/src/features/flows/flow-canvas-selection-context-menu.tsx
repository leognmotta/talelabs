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

export function FlowCanvasSelectionContextMenu({
  canArrange,
  canDuplicate,
  canFocus,
  canRun,
  deleteShortcut,
  duplicateShortcut,
  onArrange,
  onDelete,
  onDuplicate,
  onFocus,
  onRun,
}: {
  canArrange: boolean
  canDuplicate: boolean
  canFocus: boolean
  canRun: boolean
  deleteShortcut: string
  duplicateShortcut: string
  onArrange: () => void
  onDelete: () => void
  onDuplicate: () => void
  onFocus: () => void
  onRun: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <ContextMenuGroup>
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
