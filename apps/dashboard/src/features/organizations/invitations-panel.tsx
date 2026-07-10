import { zodResolver } from '@hookform/resolvers/zod'
import {
  createOrganizationInvitation,
  listOrganizationInvitationsQueryKey,
  useListOrganizationInvitations,
} from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import {
  NativeSelect,
  NativeSelectOption,
} from '@talelabs/ui/components/native-select'
import { Separator } from '@talelabs/ui/components/separator'
import { useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { LocalizedFieldError } from '../../shared/components/localized-field-error'
import { getApiErrorMessage } from '../../shared/lib/api-error'

const invitationSchema = z.object({
  email: z.string().trim().email({ error: 'validation.email' }),
  role: z.enum(['admin', 'member']),
})

type InvitationFormValues = z.infer<typeof invitationSchema>

export function InvitationsPanel({
  organizationId,
}: {
  organizationId: string | null
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form
  const invitationsQuery = useListOrganizationInvitations(
    { organizationId: organizationId ?? undefined },
    {
      query: {
        retry: false,
      },
    },
  )
  const invitations = invitationsQuery.data?.invitations ?? []

  async function handleCreateInvitation(values: InvitationFormValues) {
    if (!organizationId)
      return

    form.clearErrors('root.serverError')

    try {
      const result = await createOrganizationInvitation({
        organizationId,
        data: {
          email: values.email,
          role: values.role,
        },
      })

      form.reset({
        email: '',
        role: values.role,
      })
      await queryClient.invalidateQueries({
        queryKey: listOrganizationInvitationsQueryKey({ organizationId }),
      })
      await navigator.clipboard?.writeText(result.invitation.inviteUrl)
      toast.success(t('team.invitationCopied'))
    }
    catch (caughtError) {
      const message = getApiErrorMessage(
        caughtError,
        'team.couldNotCreateInvitation',
      )
      form.setError('root.serverError', {
        message,
        type: 'server',
      })
    }
  }

  if (!organizationId)
    return null

  return (
    <Card>
      <CardHeader>
        <CardDescription>{t('team.invitations')}</CardDescription>
        <CardTitle>{t('team.invite')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(handleCreateInvitation)}
        >
          <FieldGroup>
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-email">{t('common.email')}</FieldLabel>
                  <Input
                    {...field}
                    id="invite-email"
                    type="email"
                    placeholder="new-user@example.com"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <LocalizedFieldError error={fieldState.error} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="role"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-role">{t('common.role')}</FieldLabel>
                  <NativeSelect
                    id="invite-role"
                    value={field.value}
                    onChange={(event) => {
                      const nextRole = event.target.value === 'admin'
                        ? 'admin'
                        : 'member'
                      field.onChange(nextRole)
                    }}
                    aria-invalid={fieldState.invalid}
                  >
                    <NativeSelectOption value="member">{t('common.member')}</NativeSelectOption>
                    <NativeSelectOption value="admin">{t('common.admin')}</NativeSelectOption>
                  </NativeSelect>
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
            {isSubmitting ? t('team.generating') : t('team.generateUrl')}
          </Button>
        </form>

        <Separator />

        <div className="flex flex-col gap-3">
          {invitationsQuery.isError && (
            <p className="text-sm text-muted-foreground">
              {t('team.adminOnlyInvitations')}
            </p>
          )}
          {!invitationsQuery.isError && invitations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('team.noGeneratedInvitations')}
            </p>
          )}
          {invitations.map(invitation => (
            <div
              key={invitation.id}
              className="
                flex flex-col gap-2 rounded-md border border-border p-3
              "
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`team.${invitation.role}` as 'team.admin')}
                    {' '}
                    ·
                    {' '}
                    {t(`team.${invitation.status}` as 'team.pending')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(invitation.inviteUrl)
                    toast.success(t('team.invitationCopied'))
                  }}
                >
                  {t('team.copyUrl')}
                </Button>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {invitation.inviteUrl}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
