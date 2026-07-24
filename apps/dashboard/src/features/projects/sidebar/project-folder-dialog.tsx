/** Project-sidebar dialog for creating one root or nested Asset folder. */

import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Collects the name for one Project-scoped Asset folder creation command. */
export function ProjectFolderDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: {
  /** Whether the creation dialog is visible. */
  open: boolean
  /** Whether the owning folder mutation is currently pending. */
  pending: boolean
  /** Controls dialog visibility and reset behavior. */
  onOpenChange: (open: boolean) => void
  /** Creates the folder using the owning contextual sidebar state. */
  onSubmit: (name: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending)
          setName('')
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent closeLabel={t('common.close')}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim())
              void onSubmit(name.trim())
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('assets.newFolder')}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel className="sr-only" htmlFor="project-folder-name">
                {t('common.name')}
              </FieldLabel>
              <Input
                autoFocus
                aria-label={t('common.name')}
                id="project-folder-name"
                maxLength={255}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button disabled={!name.trim() || pending} type="submit">
              {t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
