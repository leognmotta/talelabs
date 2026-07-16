import type { ProfileFormValues } from './settings-schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { Avatar, AvatarFallback } from '@talelabs/ui/components/avatar'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Separator } from '@talelabs/ui/components/separator'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LocalizedFieldError } from '../../shared/components/localized-field-error'
import { authClient } from '../auth/auth-client'
import { profileSchema } from './settings-schemas'

export function ProfileSettings({
  email,
  initials,
  name,
  onProfileUpdated,
}: {
  email: string
  initials: string
  name: string
  onProfileUpdated: () => Promise<void>
}) {
  const { t } = useTranslation()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name,
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: ProfileFormValues) {
    form.clearErrors('root.serverError')

    try {
      const nextName = values.name.trim()
      const result = await authClient.updateUser({ name: nextName })

      if (result.error) {
        form.setError('root.serverError', {
          message: t('profile.couldNotUpdate'),
          type: 'server',
        })
        return
      }

      form.reset({ name: nextName })
      await onProfileUpdated()
      toast.success(t('profile.updated'))
    }
    catch {
      form.setError('root.serverError', {
        message: t('profile.couldNotUpdate'),
        type: 'server',
      })
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">{t('settings.profile')}</h2>
      </header>
      <Separator />
      <form
        className="flex flex-col gap-5 py-5"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <FieldGroup>
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-profile-name">{t('common.name')}</FieldLabel>
                <Input
                  {...field}
                  id="settings-profile-name"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <LocalizedFieldError error={fieldState.error} />
                )}
              </Field>
            )}
          />
          <Field>
            <FieldLabel htmlFor="settings-profile-email">{t('common.email')}</FieldLabel>
            <Input id="settings-profile-email" value={email} disabled />
          </Field>
        </FieldGroup>
        {errors.root?.serverError && (
          <FieldError>
            {errors.root.serverError.message}
          </FieldError>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('profile.save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
