import type { OrganizationSettingsFormValues } from './settings-schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  listOrganizationsQueryKey,
  updateOrganization,
  useListOrganizations,
} from '@talelabs/sdk'
import { Avatar, AvatarFallback } from '@talelabs/ui/components/avatar'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Separator } from '@talelabs/ui/components/separator'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LocalizedFieldError } from '../../shared/components/localized-field-error'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { slugify } from '../../shared/lib/slugify'
import { organizationSettingsSchema } from './settings-schemas'
import { getInitials } from './settings-utils'

export function OrganizationSettings({
  activeOrganizationId,
}: {
  activeOrganizationId: string | null
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const organizationsQuery = useListOrganizations()
  const activeOrganization = useMemo(
    () => organizationsQuery.data?.organizations.find(
      organization => organization.id === activeOrganizationId,
    ) ?? null,
    [activeOrganizationId, organizationsQuery.data],
  )
  const form = useForm<OrganizationSettingsFormValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      logo: '',
      name: '',
      slug: '',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
    reset,
  } = form
  const initials = getInitials(
    activeOrganization?.name ?? t('settings.organization'),
    activeOrganization?.slug ?? '',
  )

  useEffect(() => {
    reset({
      logo: activeOrganization?.logo ?? '',
      name: activeOrganization?.name ?? '',
      slug: activeOrganization?.slug ?? '',
    })
  }, [
    activeOrganization?.logo,
    activeOrganization?.name,
    activeOrganization?.slug,
    reset,
  ])

  async function handleSubmit(values: OrganizationSettingsFormValues) {
    form.clearErrors('root.serverError')

    if (!activeOrganizationId)
      return

    const name = values.name.trim()
    const slug = slugify(values.slug)
    const logo = values.logo.trim()

    if (!slug) {
      form.setError('slug', {
        message: 'validation.organizationSlugRequired',
        type: 'manual',
      })
      return
    }

    try {
      const result = await updateOrganization({
        organizationId: activeOrganizationId,
        data: {
          logo: logo || null,
          name,
          slug,
        },
      })

      await queryClient.invalidateQueries({
        queryKey: listOrganizationsQueryKey(),
      })
      reset({
        logo: result.organization.logo ?? '',
        name: result.organization.name,
        slug: result.organization.slug,
      })
      toast.success(t('organizations.updated'))
    }
    catch (caughtError) {
      const message = getApiErrorMessage(
        caughtError,
        'organizations.couldNotUpdate',
      )
      form.setError('root.serverError', {
        message,
        type: 'server',
      })
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">{t('settings.organization')}</h2>
      </header>
      <Separator />
      {organizationsQuery.isLoading && !activeOrganization && (
        <div className="flex flex-col gap-5 py-5">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
      {!organizationsQuery.isLoading && !activeOrganization && (
        <p className="py-5 text-sm text-muted-foreground">
          {t('organizations.noActive')}
        </p>
      )}
      {activeOrganization && (
        <form
          className="flex flex-col gap-5 py-5"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="flex items-center gap-4">
            <Avatar className="size-14 rounded-2xl">
              <AvatarFallback className="rounded-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{activeOrganization.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {activeOrganization.slug}
              </p>
            </div>
          </div>
          <FieldGroup>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-organization-name">
                    {t('common.name')}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="settings-organization-name"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <LocalizedFieldError error={fieldState.error} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="slug"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-organization-slug">
                    {t('organizations.slug')}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="settings-organization-slug"
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      field.onChange(slugify(event.target.value))
                    }}
                  />
                  <FieldDescription>
                    {t('organizations.slugDescription')}
                  </FieldDescription>
                  {fieldState.invalid && (
                    <LocalizedFieldError error={fieldState.error} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="logo"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="settings-organization-logo">
                    {t('organizations.logoUrl')}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="settings-organization-logo"
                    aria-invalid={fieldState.invalid}
                    placeholder="https://example.com/logo.png"
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
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('organizations.save')}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
