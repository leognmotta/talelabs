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
import { toast } from 'sonner'
import { z } from 'zod'

const invitationSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum(['admin', 'member']),
})

type InvitationFormValues = z.infer<typeof invitationSchema>

export function InvitationsPanel({
  organizationId,
}: {
  organizationId: string | null
}) {
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
      toast.success('Invitation URL copied')
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

  if (!organizationId)
    return null

  return (
    <Card>
      <CardHeader>
        <CardDescription>Invitations</CardDescription>
        <CardTitle>Invite users</CardTitle>
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
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="invite-email"
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
                  <FieldLabel htmlFor="invite-role">Role</FieldLabel>
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
            <FieldError>
              {errors.root.serverError.message}
            </FieldError>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Generating...' : 'Generate invite URL'}
          </Button>
        </form>

        <Separator />

        <div className="flex flex-col gap-3">
          {invitationsQuery.isError && (
            <p className="text-sm text-muted-foreground">
              Organization admins can generate and view invitations.
            </p>
          )}
          {!invitationsQuery.isError && invitations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No invitations have been generated.
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
                    {invitation.role}
                    {' '}
                    ·
                    {' '}
                    {invitation.status}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(invitation.inviteUrl)
                    toast.success('Invitation URL copied')
                  }}
                >
                  Copy URL
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
