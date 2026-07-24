/** Bounded dialog shell for selecting a Project and optional Asset folder. */

import type { Folder } from '@talelabs/sdk'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { useTranslation } from 'react-i18next'

import {
  ProjectLocationDialogForm,
} from './project-location-dialog-form'

/** Opens a bounded Project/folder picker and returns one explicit location. */
export function ProjectLocationDialog({
  currentFolderId,
  currentProjectId,
  description,
  includeFolder = true,
  open,
  pending,
  projectLocked = false,
  title,
  validateDestination,
  onConfirm,
  onOpenChange,
}: {
  /** Currently selected folder, or Project/Private root when null. */
  currentFolderId?: null | string
  /** Currently selected Project, or Private when null. */
  currentProjectId: null | string
  /** Optional explanation for the owning relocation workflow. */
  description?: string
  /** Whether the destination includes a folder position. */
  includeFolder?: boolean
  /** Whether the location dialog is visible. */
  open: boolean
  /** Whether the owning location mutation is pending. */
  pending: boolean
  /** Keeps Project identity fixed while allowing folder selection. */
  projectLocked?: boolean
  /** Optional workflow-specific dialog title. */
  title?: string
  /** Optionally validates a candidate destination before confirmation. */
  validateDestination?: (
    projectId: null | string,
    folderId: null | string,
    folders: Folder[],
  ) => boolean
  /** Persists the selected Project, folder, and presentation label. */
  onConfirm: (
    projectId: null | string,
    folderId: null | string,
    destinationLabel: string,
  ) => Promise<void>
  /** Controls dialog visibility. */
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(44rem,calc(100vh-2rem))] flex-col"
        closeLabel={t('common.close')}
      >
        <DialogHeader>
          <DialogTitle>
            {title ?? t('projects.changeLocation')}
          </DialogTitle>
          <DialogDescription>
            {description ?? t('projects.locationDescription')}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProjectLocationDialogForm
            currentFolderId={currentFolderId}
            currentProjectId={currentProjectId}
            includeFolder={includeFolder}
            key={JSON.stringify([currentProjectId, currentFolderId])}
            pending={pending}
            projectLocked={projectLocked}
            validateDestination={validateDestination}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
