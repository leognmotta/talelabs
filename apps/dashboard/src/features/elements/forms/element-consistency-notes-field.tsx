import type { FieldError, UseFormRegisterReturn } from 'react-hook-form'

import { Textarea } from '@talelabs/ui/components/textarea'
import { useTranslation } from 'react-i18next'
import { ElementFormField } from './element-form-field'

export function ElementConsistencyNotesField({
  error,
  registration,
}: {
  error?: FieldError
  registration: UseFormRegisterReturn
}) {
  const { t } = useTranslation()

  return (
    <ElementFormField
      id="element-consistency-notes"
      label={t('elements.consistencyNotes.label')}
      description={t('elements.consistencyNotes.description')}
      error={error}
    >
      <Textarea
        id="element-consistency-notes"
        aria-invalid={Boolean(error)}
        rows={3}
        {...registration}
      />
    </ElementFormField>
  )
}
