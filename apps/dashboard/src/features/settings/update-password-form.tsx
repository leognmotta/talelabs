import type { UpdatePasswordFormValues } from './settings-schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LocalizedFieldError } from '../../shared/components/localized-field-error'
import { getAuthErrorMessage } from '../../shared/lib/auth-error'
import { authClient } from '../auth/auth-client'
import { updatePasswordSchema } from './settings-schemas'

export function UpdatePasswordForm({
  onPasswordChanged,
}: {
  onPasswordChanged: () => Promise<void>
}) {
  const { t } = useTranslation()
  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: UpdatePasswordFormValues) {
    form.clearErrors('root.serverError')

    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: false,
      })

      if (result.error) {
        form.setError('root.serverError', {
          message: getAuthErrorMessage(
            result.error,
            'security.couldNotUpdatePassword',
          ),
          type: 'server',
        })
        return
      }

      form.reset()
      await onPasswordChanged()
      toast.success(t('security.passwordUpdated'))
    }
    catch {
      form.setError('root.serverError', {
        message: t('security.couldNotUpdatePassword'),
        type: 'server',
      })
    }
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <FieldGroup className="gap-4">
        <Controller
          name="currentPassword"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="settings-current-password">
                {t('settings.currentPassword')}
              </FieldLabel>
              <Input
                {...field}
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <LocalizedFieldError error={fieldState.error} />
              )}
            </Field>
          )}
        />
        <Controller
          name="newPassword"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="settings-new-password">
                {t('settings.newPassword')}
              </FieldLabel>
              <Input
                {...field}
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <LocalizedFieldError error={fieldState.error} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
      {errors.root?.serverError && (
        <FieldError>
          {errors.root.serverError.message}
        </FieldError>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('security.updatingPassword') : t('security.updatePassword')}
      </Button>
    </form>
  )
}
