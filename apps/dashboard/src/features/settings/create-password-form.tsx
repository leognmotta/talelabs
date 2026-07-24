/** Password-creation form for authenticated users without a password credential. */

import type { CreatePasswordFormValues } from './settings-schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { setAccountPassword } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldError,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LocalizedFieldError } from '../../shared/components/localized-field-error'
import { PasswordInput } from '../../shared/components/password-input'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { createPasswordSchema } from './settings-schemas'

/** Creates the caller's initial password and refreshes credential state. */
export function CreatePasswordForm({
  onPasswordChanged,
}: {
  onPasswordChanged: () => Promise<void>
}) {
  const { t } = useTranslation()
  const form = useForm<CreatePasswordFormValues>({
    resolver: zodResolver(createPasswordSchema),
    defaultValues: {
      newPassword: '',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: CreatePasswordFormValues) {
    form.clearErrors('root.serverError')

    try {
      await setAccountPassword({
        data: {
          newPassword: values.newPassword,
        },
      })

      form.reset()
      await onPasswordChanged()
      toast.success(t('security.passwordCreated'))
    }
    catch (caughtError) {
      const message = getApiErrorMessage(
        caughtError,
        'security.couldNotCreatePassword',
      )

      form.setError('root.serverError', {
        message,
        type: 'server',
      })
    }
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <Controller
        name="newPassword"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="settings-create-password">
              {t('common.password')}
            </FieldLabel>
            <PasswordInput
              {...field}
              id="settings-create-password"
              autoComplete="new-password"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && (
              <LocalizedFieldError error={fieldState.error} />
            )}
          </Field>
        )}
      />
      {errors.root?.serverError && (
        <FieldError>
          {errors.root.serverError.message}
        </FieldError>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('security.creatingPassword') : t('security.createPassword')}
      </Button>
    </form>
  )
}
