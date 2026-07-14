import type { Flow } from '@talelabs/sdk'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowLeft,
  IconChevronDown,
  IconEdit,
  IconPlus,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { TaleLabsLogo } from '../../shared/components/talelabs-logo'
import { useSettingsTabState } from '../settings/settings-state'
import { CreateFlowDialog } from './create-flow-dialog'
import { DeleteFlowDialog } from './delete-flow-dialog'
import { getFlowCanvasShortcutLabels } from './flow-canvas-shortcuts'
import { RenameFlowDialog } from './rename-flow-dialog'

export function FlowCanvasHeader({
  canRedo,
  canUndo,
  flow,
  onFlowDeleted,
  onRedo,
  onUndo,
}: {
  canRedo: boolean
  canUndo: boolean
  flow: Flow
  onFlowDeleted: () => void
  onRedo: () => void
  onUndo: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [, setSettingsTab] = useSettingsTabState()
  const shortcutLabels = getFlowCanvasShortcutLabels()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  function handleDeleted() {
    onFlowDeleted()
    navigate('/flows', { replace: true })
  }

  return (
    <>
      <div className="
        nodrag nopan flex h-11 min-w-0 items-center overflow-hidden rounded-xl
        border border-border/90 bg-card/95 shadow-lg backdrop-blur-sm
      "
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(
              <Button
                aria-label={t('common.moreOptions')}
                className="h-10 rounded-r-none px-2.5"
                type="button"
                variant="ghost"
              />
            )}
          >
            <TaleLabsLogo className="size-5" variant="icon" />
            <IconChevronDown
              aria-hidden
              className="size-3.5 text-muted-foreground"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/flows')}>
                <IconArrowLeft />
                {t('flows.backToFlows')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                <IconPlus />
                {t('flows.create')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <IconEdit />
                {t('flows.rename')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void setSettingsTab('general')}
              >
                <IconSettings />
                {t('navigation.settings')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={!canUndo} onClick={onUndo}>
                <IconArrowBackUp />
                {t('flows.undo')}
                <DropdownMenuShortcut>{shortcutLabels.undo}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canRedo} onClick={onRedo}>
                <IconArrowForwardUp />
                {t('flows.redo')}
                <DropdownMenuShortcut>{shortcutLabels.redo}</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <IconTrash />
                {t('flows.delete')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span aria-hidden className="h-5 w-px shrink-0 bg-border/80" />
        <p
          className="max-w-72 min-w-0 truncate px-3 text-sm font-medium"
          title={flow.name}
        >
          {flow.name}
        </p>
      </div>
      <CreateFlowDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RenameFlowDialog
        flow={renameOpen ? flow : null}
        onOpenChange={setRenameOpen}
      />
      <DeleteFlowDialog
        flow={deleteOpen ? flow : null}
        onDeleted={handleDeleted}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
