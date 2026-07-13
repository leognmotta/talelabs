import type { Flow } from '@talelabs/sdk'
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
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { useRenameFlowMutation } from './flow.queries'

export function RenameFlowDialog({
  flow,
  onOpenChange,
}: {
  flow: Flow | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const renameFlow = useRenameFlowMutation()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('name') ?? '').trim()
    if (!flow || !organizationId || !value)
      return
    try {
      await renameFlow.mutateAsync({ id: flow.id, name: value, organizationId })
      onOpenChange(false)
      toast.success(t('flows.renamed'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'flows.actionFailed'))
    }
  }

  return (
    <Dialog open={Boolean(flow)} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <form key={flow?.id} className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('flows.rename')}</DialogTitle>
            <DialogDescription>{t('flows.renameDescription')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rename-flow-name">{t('common.name')}</FieldLabel>
              <Input
                autoFocus
                defaultValue={flow?.name ?? ''}
                id="rename-flow-name"
                maxLength={255}
                name="name"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={!flow || renameFlow.isPending}
              type="submit"
            >
              {renameFlow.isPending && <Spinner data-icon="inline-start" />}
              {renameFlow.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
