/** Rename dialog for one durable Create session identity. */

import type { CreateSession } from '@talelabs/sdk'

import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { Field, FieldGroup, FieldLabel } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useRenameCreateSessionMutation } from '../data/create-session.mutations'

/** Commits a user-authored session name without changing its runs or draft. */
export function RenameCreateSessionDialog({
  organizationId,
  session,
  onOpenChange,
}: {
  /** Tenant owning the selected session. */
  organizationId: string
  /** Session being renamed, or null while the dialog is closed. */
  session: CreateSession | null
  /** Controls the caller-owned dialog selection. */
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const renameSession = useRenameCreateSessionMutation(organizationId)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(
      new FormData(event.currentTarget).get('name') ?? '',
    ).trim()
    if (!session || !name)
      return
    try {
      await renameSession.mutateAsync({ id: session.id, name })
      onOpenChange(false)
      toast.success(t('create.sessions.renamed'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'create.sessions.actionFailed'))
    }
  }

  return (
    <Dialog open={Boolean(session)} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <form
          key={session?.id}
          className="flex flex-col gap-6"
          onSubmit={handleSubmit}
        >
          <DialogHeader>
            <DialogTitle>{t('create.sessions.rename')}</DialogTitle>
            <DialogDescription>
              {t('create.sessions.renameDescription')}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rename-create-session">
                {t('common.name')}
              </FieldLabel>
              <Input
                autoFocus
                defaultValue={session?.name ?? ''}
                id="rename-create-session"
                maxLength={120}
                name="name"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button disabled={!session || renameSession.isPending} type="submit">
              {renameSession.isPending && <Spinner data-icon="inline-start" />}
              {renameSession.isPending
                ? t('common.saving')
                : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
