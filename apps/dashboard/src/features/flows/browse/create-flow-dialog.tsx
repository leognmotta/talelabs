/** New-Flow name capture and creation mutation boundary. */

import { IconPlus } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  Field,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { useCreateFlowMutation } from '../data/flow-mutations'

/** Creates one empty Flow and hands navigation ownership back to the browse screen. */
export function CreateFlowDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useActiveOrganizationId()
  const createFlow = useCreateFlowMutation()
  const [name, setName] = useState('')

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !createFlow.isPending)
      setName('')
    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = name.trim()
    if (!organizationId || !value)
      return

    try {
      const flow = await createFlow.mutateAsync({
        name: value,
        organizationId,
      })
      setName('')
      onOpenChange(false)
      toast.success(t('flows.created'))
      navigate(`/flows/${flow.id}`)
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'flows.actionFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('flows.create')}</DialogTitle>
            <DialogDescription>{t('flows.createDescription')}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="flow-name">{t('common.name')}</FieldLabel>
              <Input
                autoFocus
                id="flow-name"
                maxLength={255}
                placeholder={t('flows.namePlaceholder')}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={!name.trim() || !organizationId || createFlow.isPending}
              type="submit"
            >
              {createFlow.isPending
                ? <Spinner data-icon="inline-start" />
                : <IconPlus data-icon="inline-start" />}
              {createFlow.isPending ? t('common.saving') : t('flows.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
