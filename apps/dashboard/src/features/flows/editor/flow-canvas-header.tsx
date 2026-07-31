/** Flow identity, navigation, history, and document commands above the canvas. */

import type { Flow } from '@talelabs/sdk'
import type { AssetDestinationSelection } from '../../projects/asset-destination-picker'
import type { FlowSaveStatus } from './flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowLeft,
  IconChevronDown,
  IconEdit,
  IconMapPin,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { TaleLabsLogo } from '../../../shared/components/talelabs-logo'
import { BillingCanvasCredits } from '../../billing/billing-canvas-credits'
import { AssetDestinationPicker } from '../../projects/asset-destination-picker'
import { useSettingsTabState } from '../../settings/settings-state'
import { CreateFlowDialog } from '../browse/create-flow-dialog'
import { DeleteFlowDialog } from '../browse/delete-flow-dialog'
import { FlowLocationDialog } from '../browse/flow-location-dialog'
import { RenameFlowDialog } from '../browse/rename-flow-dialog'
import { FlowCanvasSaveStatus } from './flow-canvas-save-status'
import { getFlowCanvasShortcutLabels } from './interactions/flow-canvas-shortcuts'

/** Renders Flow navigation, identity, document commands, and history controls. */
export const FlowCanvasHeader = memo(({
  canRedo,
  canUndo,
  destinationFolderId,
  flow,
  organizationId,
  saveStatus,
  onFlowDeleted,
  onDestinationFolderChange,
  onRedo,
  onRetrySave,
  onUndo,
}: {
  canRedo: boolean
  canUndo: boolean
  destinationFolderId: AssetDestinationSelection
  flow: Flow
  organizationId: string
  saveStatus: FlowSaveStatus
  onFlowDeleted: () => void
  onDestinationFolderChange: (value: AssetDestinationSelection) => void
  onRedo: () => void
  onRetrySave: () => void
  onUndo: () => void
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [, setSettingsTab] = useSettingsTabState()
  const shortcutLabels = getFlowCanvasShortcutLabels()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const projectScoped = flow.projectId !== null

  function handleDeleted() {
    onFlowDeleted()
    navigate(
      flow.projectId ? `/projects/${flow.projectId}/flows` : '/flows',
      { replace: true },
    )
  }
  const flowsPath = flow.projectId
    ? `/projects/${flow.projectId}/flows`
    : '/flows'

  return (
    <>
      <div
        className="
          nodrag nopan flex h-9 min-w-0 items-center overflow-hidden rounded-xl
          p-0.5
        "
        data-flow-chrome
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(
              <Button
                aria-label={t('common.moreOptions')}
                className="h-8 rounded-lg px-2"
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
          <DropdownMenuContent align="start" className="w-72" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate(flowsPath)}>
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
              {projectScoped
                ? null
                : (
                    <DropdownMenuItem onClick={() => setLocationOpen(true)}>
                      <IconMapPin />
                      {t('projects.changeLocation')}
                      <DropdownMenuShortcut>
                        {t('projects.private')}
                      </DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
              <DropdownMenuLabel className="p-1">
                <AssetDestinationPicker
                  className="
                    w-full justify-start border-0 bg-transparent shadow-none
                  "
                  projectId={flow.projectId}
                  sourceFolderId={flow.assetFolderId}
                  value={destinationFolderId}
                  onChange={onDestinationFolderChange}
                />
              </DropdownMenuLabel>
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
        <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/80" />
        <p
          className="max-w-64 min-w-0 truncate px-2 text-sm font-medium"
          title={flow.name}
        >
          {flow.name}
        </p>
        <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/80" />
        <div className="shrink-0 pr-0.5">
          <FlowCanvasSaveStatus
            status={saveStatus}
            onRetrySave={onRetrySave}
          />
        </div>
        <span aria-hidden className="mx-0.5 h-4 w-px shrink-0 bg-border/80" />
        <BillingCanvasCredits
          organizationId={organizationId}
          onOpenCredits={() => void setSettingsTab('credits')}
        />
      </div>
      <CreateFlowDialog
        open={createOpen}
        projectId={flow.projectId}
        onOpenChange={setCreateOpen}
      />
      <RenameFlowDialog
        flow={renameOpen ? flow : null}
        onOpenChange={setRenameOpen}
      />
      {projectScoped
        ? null
        : (
            <FlowLocationDialog
              flow={locationOpen ? flow : null}
              onOpenChange={setLocationOpen}
            />
          )}
      <DeleteFlowDialog
        flow={deleteOpen ? flow : null}
        onDeleted={handleDeleted}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
})
