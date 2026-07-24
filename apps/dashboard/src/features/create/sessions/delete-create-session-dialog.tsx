/** Confirmation boundary for hiding one durable Create session. */

import type { CreateSession } from '@talelabs/sdk'

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
import { useDeleteCreateSessionMutation } from '../data/create-session.mutations'

/** Soft-deletes a session while retaining generated Assets and provenance. */
export function DeleteCreateSessionDialog({
  organizationId,
  session,
  onDeleted,
  onOpenChange,
}: {
  /** Tenant owning the selected session. */
  organizationId: string
  /** Session being deleted, or null while the dialog is closed. */
  session: CreateSession | null
  /** Runs after the server accepts the deletion. */
  onDeleted: (sessionId: string) => void
  /** Controls the caller-owned dialog selection. */
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const deleteSession = useDeleteCreateSessionMutation(organizationId)

  async function handleDelete() {
    if (!session)
      return
    try {
      await deleteSession.mutateAsync(session.id)
      onOpenChange(false)
      onDeleted(session.id)
      toast.success(t('create.sessions.deleted'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'create.sessions.actionFailed'))
    }
  }

  return (
    <AlertDialog open={Boolean(session)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('create.sessions.delete')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('create.sessions.deleteDescription', {
              name: session?.name ?? t('create.sessions.untitled'),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSession.isPending}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteSession.isPending}
            variant="destructive"
            onClick={() => void handleDelete()}
          >
            {deleteSession.isPending && <Spinner data-icon="inline-start" />}
            {deleteSession.isPending
              ? t('create.sessions.deleting')
              : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
