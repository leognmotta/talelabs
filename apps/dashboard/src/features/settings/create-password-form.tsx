import type { CreatePasswordFormValues } from './settings-schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { setAccountPassword } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldError,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { createPasswordSchema } from './settings-schemas'

export function CreatePasswordForm({
  onPasswordChanged,
}: {
  onPasswordChanged: () => Promise<void>
}) {
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
      toast.success('Password created')
    }
    catch (caughtError) {
      const message = getApiErrorMessage(
        caughtError,
        'Could not create password.',
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
              Password
            </FieldLabel>
            <Input
              {...field}
              id="settings-create-password"
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
      {errors.root?.serverError && (
        <FieldError>
          {errors.root.serverError.message}
        </FieldError>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create password'}
      </Button>
    </form>
  )
}
