import type { ReactNode } from 'react'
import type { FieldError } from 'react-hook-form'

import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { LocalizedFieldError } from '../../../shared/components/localized-field-error'

export function ElementFormField({
  children,
  description,
  error,
  id,
  label,
}: {
  children: ReactNode
  description?: string
  error?: FieldError
  id: string
  label: string
}) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <LocalizedFieldError error={error} />
    </Field>
  )
}
