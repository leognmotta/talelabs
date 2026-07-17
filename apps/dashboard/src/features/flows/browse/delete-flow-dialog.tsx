/** Explicit confirmation boundary for deleting a Flow identity and graph. */

import type { Flow } from '@talelabs/sdk'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@talelabs/ui/components/alert-dialog'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { useDeleteFlowMutation } from '../data/flow-mutations'

/** Requires confirmation before the caller dispatches the destructive mutation. */
export function DeleteFlowDialog({
  flow,
  onDeleted,
  onOpenChange,
}: {
  flow: Flow | null
  onDeleted?: () => void
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const deleteFlow = useDeleteFlowMutation()

  async function handleDelete() {
    if (!flow || !organizationId)
      return
    try {
      await deleteFlow.mutateAsync({ id: flow.id, organizationId })
      onOpenChange(false)
      onDeleted?.()
      toast.success(t('flows.deleted'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'flows.actionFailed'))
    }
  }

  return (
    <AlertDialog open={Boolean(flow)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('flows.delete')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('flows.deleteDescription', { name: flow?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteFlow.isPending}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteFlow.isPending}
            variant="destructive"
            onClick={() => void handleDelete()}
          >
            {deleteFlow.isPending && <Spinner data-icon="inline-start" />}
            {deleteFlow.isPending ? t('flows.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
