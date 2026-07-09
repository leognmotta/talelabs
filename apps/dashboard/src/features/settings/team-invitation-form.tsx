import type { TeamInvitationFormValues } from './settings-schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  createOrganizationInvitation,
  listOrganizationInvitationsQueryKey,
} from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
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
import { useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { teamInvitationSchema } from './settings-schemas'

export function TeamInvitationForm({
  onInvitationCreated,
  organizationId,
}: {
  onInvitationCreated: () => void
  organizationId: string
}) {
  const queryClient = useQueryClient()
  const form = useForm<TeamInvitationFormValues>({
    resolver: zodResolver(teamInvitationSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: TeamInvitationFormValues) {
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
      toast.success('Invitation URL copied')
      onInvitationCreated()
    }
    catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Could not create invitation.'
      form.setError('root.serverError', {
        message,
        type: 'server',
      })
    }
  }

  return (
    <form
      className="rounded-2xl border border-border p-4"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <FieldGroup>
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="team-invite-email">Email</FieldLabel>
              <Input
                {...field}
                id="team-invite-email"
                type="email"
                placeholder="new-user@example.com"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
        <Controller
          name="role"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="team-invite-role">Role</FieldLabel>
              <NativeSelect
                id="team-invite-role"
                value={field.value}
                onChange={(event) => {
                  const nextRole = event.target.value === 'admin'
                    ? 'admin'
                    : 'member'
                  field.onChange(nextRole)
                }}
                aria-invalid={fieldState.invalid}
              >
                <NativeSelectOption value="member">Member</NativeSelectOption>
                <NativeSelectOption value="admin">Admin</NativeSelectOption>
              </NativeSelect>
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
      {errors.root?.serverError && (
        <FieldError className="mt-4">
          {errors.root.serverError.message}
        </FieldError>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send invite'}
        </Button>
      </div>
    </form>
  )
}
