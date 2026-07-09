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
import { toast } from 'sonner'
import { authClient } from '../auth/auth-client'
import { updatePasswordSchema } from './settings-schemas'

export function UpdatePasswordForm({
  onPasswordChanged,
}: {
  onPasswordChanged: () => Promise<void>
}) {
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
          message: result.error.message ?? 'Could not update password.',
          type: 'server',
        })
        return
      }

      form.reset()
      await onPasswordChanged()
      toast.success('Password updated')
    }
    catch {
      form.setError('root.serverError', {
        message: 'Could not update password.',
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
                Current password
              </FieldLabel>
              <Input
                {...field}
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
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
                New password
              </FieldLabel>
              <Input
                {...field}
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
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
        {isSubmitting ? 'Updating...' : 'Update password'}
      </Button>
    </form>
  )
}
