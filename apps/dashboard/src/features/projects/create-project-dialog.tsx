/** Minimal Project creation dialog shared by list and location controls. */

import type { Project } from '@talelabs/sdk'

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
import { Field, FieldGroup, FieldLabel } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Textarea } from '@talelabs/ui/components/textarea'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { useProjectMutations } from './project-mutations'

/** Captures only the approved Project name and optional description. */
export function CreateProjectDialog({
  onCreated,
  onOpenChange,
  open,
}: {
  /** Receives the committed Project so callers may navigate or select it. */
  onCreated?: (project: Project) => void
  /** Controls dialog visibility. */
  onOpenChange: (open: boolean) => void
  /** Whether the creation dialog is visible. */
  open: boolean
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const mutations = useProjectMutations(organizationId)
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')

  function reset() {
    setDescription('')
    setName('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!organizationId || !trimmedName)
      return
    try {
      const project = await mutations.create.mutateAsync({
        description: description.trim(),
        name: trimmedName,
      })
      reset()
      onOpenChange(false)
      onCreated?.(project)
      toast.success(t('projects.created'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'projects.actionFailed'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !mutations.create.isPending)
          reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent closeLabel={t('common.close')}>
        <form className="flex flex-col gap-6" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('projects.create')}</DialogTitle>
            <DialogDescription>
              {t('projects.createDescription')}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="project-name">
                {t('common.name')}
              </FieldLabel>
              <Input
                autoFocus
                id="project-name"
                maxLength={120}
                placeholder={t('projects.namePlaceholder')}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-description">
                {t('projects.description')}
              </FieldLabel>
              <Textarea
                id="project-description"
                maxLength={500}
                placeholder={t('projects.descriptionPlaceholder')}
                value={description}
                onChange={event => setDescription(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={!name.trim() || mutations.create.isPending}
              type="submit"
            >
              <IconPlus data-icon="inline-start" />
              {mutations.create.isPending
                ? t('common.saving')
                : t('projects.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
