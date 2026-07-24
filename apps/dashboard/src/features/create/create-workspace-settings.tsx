/**
 * Project-location and generated-Asset destination dialogs for Create.
 *
 * Create's action menu opens each concern independently while the component
 * preserves draft relocation and durable-session mutation behavior.
 */

import type { CreateSession } from '@talelabs/sdk'
import type { AssetDestinationSelection } from '../projects/asset-destination-picker'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import {
  AssetDestinationPicker,
} from '../projects/asset-destination-picker'
import {
  ProjectLocationDialog,
} from '../projects/project-location-dialog'
import { useUpdateCreateSessionMutation } from './data/create-session.mutations'

/** Renders independent Create location and output-folder dialogs. */
export function CreateWorkspaceSettings({
  createSession,
  destination,
  organizationId,
  projectId,
  section,
  onDestinationChange,
  onDraftProjectChange,
  onClose,
}: {
  /** Durable session being edited, or null for an unsaved draft. */
  createSession: CreateSession | null
  /** Explicit next-run destination override, or inherited resolution. */
  destination: AssetDestinationSelection
  /** Tenant owning the session and candidate Projects. */
  organizationId: string
  /** Fixed Project route scope, or undefined for global Create. */
  projectId?: null | string
  /** Independent workspace concern currently open from the action menu. */
  section: 'location' | 'outputFolder' | null
  /** Updates the next-run destination override. */
  onDestinationChange: (destination: AssetDestinationSelection) => void
  /** Moves an unsaved draft into the selected Project scope. */
  onDraftProjectChange: (projectId: null | string) => void
  /** Closes the active workspace dialog. */
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const updateSession = useUpdateCreateSessionMutation(organizationId)
  const projectScoped = typeof projectId === 'string'
  const effectiveProjectId = createSession?.projectId ?? projectId ?? null

  return (
    <>
      <Dialog
        open={section === 'outputFolder'}
        onOpenChange={open => !open && onClose()}
      >
        <DialogContent
          className="max-h-[min(24rem,calc(100svh-2rem))] overflow-y-auto"
          closeLabel={t('common.close')}
        >
          <DialogHeader>
            <DialogTitle>{t('projects.outputFolder')}</DialogTitle>
          </DialogHeader>
          <AssetDestinationPicker
            className="
              w-full justify-between rounded-lg border border-border/70
              bg-muted/25 px-3
            "
            projectId={effectiveProjectId}
            sourceFolderId={createSession?.assetFolderId}
            value={destination}
            onChange={onDestinationChange}
          />
        </DialogContent>
      </Dialog>
      {!projectScoped && (
        <ProjectLocationDialog
          currentProjectId={effectiveProjectId}
          includeFolder={false}
          open={section === 'location'}
          pending={updateSession.isPending}
          onConfirm={async (nextProjectId, folderId) => {
            try {
              if (!createSession) {
                onDraftProjectChange(nextProjectId)
                onClose()
                return
              }
              const session = await updateSession.mutateAsync({
                data: {
                  assetFolderId: nextProjectId === effectiveProjectId
                    ? createSession.assetFolderId
                    : folderId,
                  projectId: nextProjectId,
                },
                id: createSession.id,
              })
              onClose()
              toast.success(t('projects.locationUpdated'))
              navigate(session.projectId
                ? `/projects/${session.projectId}/create/${session.id}`
                : `/create/${session.id}`, { replace: true })
            }
            catch (error) {
              toast.error(getApiErrorMessage(
                error,
                'create.sessions.actionFailed',
              ))
            }
          }}
          onOpenChange={open => !open && onClose()}
        />
      )}
    </>
  )
}
