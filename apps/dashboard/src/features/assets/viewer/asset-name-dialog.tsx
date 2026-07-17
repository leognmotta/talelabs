/** Shared create/rename name dialog with caller-owned mutation lifecycle. */

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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Owns only the editable name draft; persistence remains with its caller. */
export function AssetNameDialog({
  description,
  initialName = '',
  onOpenChange,
  onSubmit,
  open,
  pending,
  submitLabel,
  title,
}: {
  description: string
  initialName?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<void>
  open: boolean
  pending: boolean
  submitLabel: string
  title: string
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim())
              void onSubmit(name.trim())
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="asset-name">{t('common.name')}</FieldLabel>
              <Input
                autoFocus
                id="asset-name"
                maxLength={255}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={pending || !name.trim()} type="submit">
              {pending ? t('common.saving') : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
