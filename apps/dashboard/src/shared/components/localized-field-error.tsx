import type { FieldError as ReactHookFormFieldError } from 'react-hook-form'

import { FieldError } from '@talelabs/ui/components/field'
import { useTranslation } from 'react-i18next'

const validationOptions: Readonly<Record<string, Record<string, number>>> = {
  'validation.passwordMinLength': { minimum: 8 },
}

export function LocalizedFieldError({
  className,
  error,
}: {
  className?: string
  error: ReactHookFormFieldError | undefined
}) {
  const { t } = useTranslation()

  if (!error?.message)
    return null

  const message = error.message

  return (
    <FieldError className={className}>
      {t(message as 'validation.required', {
        ...validationOptions[message],
        defaultValue: message,
      })}
    </FieldError>
  )
}
