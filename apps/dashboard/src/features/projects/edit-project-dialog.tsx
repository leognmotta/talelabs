/**
 * Project metadata editor shared by compact Project-level action surfaces.
 */

import type { Project } from '@talelabs/sdk'

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@talelabs/ui/components/select'
import { Textarea } from '@talelabs/ui/components/textarea'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useFoldersQuery } from '../assets/data/folder-query'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { useProjectMutations } from './project-mutations'

/** Edits the bounded Project name and description contract. */
export function EditProjectDialog({
  open,
  project,
  onOpenChange,
}: {
  /** Whether the editor is visible. */
  open: boolean
  /** Project whose metadata is being edited. */
  project: Project
  /** Controls dialog visibility. */
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const mutations = useProjectMutations(organizationId)
  const foldersQuery = useFoldersQuery(open, project.id)
  const [description, setDescription] = useState(project.description)
  const [defaultFolderId, setDefaultFolderId] = useState(
    project.defaultAssetFolderId ?? 'root',
  )
  const [name, setName] = useState(project.name)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName)
      return
    try {
      await mutations.update.mutateAsync({
        data: {
          defaultAssetFolderId: defaultFolderId === 'root'
            ? null
            : defaultFolderId,
          description: description.trim(),
          name: trimmedName,
        },
        projectId: project.id,
      })
      onOpenChange(false)
      toast.success(t('projects.updatedProject'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'projects.actionFailed'))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDescription(project.description)
          setDefaultFolderId(project.defaultAssetFolderId ?? 'root')
          setName(project.name)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent closeLabel={t('common.close')}>
        <form className="flex flex-col gap-6" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('projects.edit')}</DialogTitle>
            <DialogDescription>
              {t('projects.editDescription')}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-project-name">
                {t('common.name')}
              </FieldLabel>
              <Input
                autoFocus
                id="edit-project-name"
                maxLength={120}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-project-description">
                {t('projects.description')}
              </FieldLabel>
              <Textarea
                id="edit-project-description"
                maxLength={500}
                value={description}
                onChange={event => setDescription(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('projects.defaultAssetFolder')}</FieldLabel>
              <Select
                value={defaultFolderId}
                onValueChange={value => setDefaultFolderId(value ?? 'root')}
              >
                <SelectTrigger
                  aria-label={t('projects.defaultAssetFolder')}
                  className="w-full"
                >
                  <span className="truncate">
                    {defaultFolderId === 'root'
                      ? t('projects.projectRoot')
                      : foldersQuery.data?.data.find(
                        folder => folder.id === defaultFolderId,
                      )?.name ?? t('projects.destinationUnavailable')}
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectItem value="root">
                      {t('projects.projectRoot')}
                    </SelectItem>
                    {foldersQuery.data?.data.map(folder => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              disabled={!name.trim() || mutations.update.isPending}
              type="submit"
            >
              {mutations.update.isPending
                ? t('common.saving')
                : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
