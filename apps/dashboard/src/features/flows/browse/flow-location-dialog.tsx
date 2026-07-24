/** Persistent Project and output-folder location dialog for one Flow. */

import type { Flow } from '@talelabs/sdk'

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { ProjectLocationDialog } from '../../projects/project-location-dialog'
import { useUpdateFlowLocationMutation } from '../data/flow-mutations'

/** Moves future Flow work while immutable historical runs keep their capture. */
export function FlowLocationDialog({
  flow,
  onOpenChange,
}: {
  flow: Flow | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const updateFlow = useUpdateFlowLocationMutation()

  return (
    <ProjectLocationDialog
      currentFolderId={flow?.assetFolderId}
      currentProjectId={flow?.projectId ?? null}
      open={Boolean(flow)}
      pending={updateFlow.isPending}
      onConfirm={async (projectId, folderId) => {
        if (!flow || !organizationId)
          return
        try {
          await updateFlow.mutateAsync({
            data: { assetFolderId: folderId, projectId },
            id: flow.id,
            organizationId,
          })
          onOpenChange(false)
          toast.success(t('projects.locationUpdated'))
        }
        catch (error) {
          toast.error(getApiErrorMessage(error, 'flows.actionFailed'))
        }
      }}
      onOpenChange={onOpenChange}
    />
  )
}
