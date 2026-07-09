import type { FormEvent } from 'react'

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
import { useState } from 'react'
import { toast } from 'sonner'

export function InvitationsPanel({
  organizationId,
}: {
  organizationId: string | null
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const invitationsQuery = useListOrganizationInvitations(
    { organizationId: organizationId ?? undefined },
    {
      query: {
        retry: false,
      },
    },
  )
  const invitations = invitationsQuery.data?.invitations ?? []

  async function handleCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!organizationId)
      return

    setError(null)
    setIsCreating(true)

    try {
      const result = await createOrganizationInvitation({
        organizationId,
        data: {
          email,
          role,
        },
      })

      setEmail('')
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
      setError(message)
    }
    finally {
      setIsCreating(false)
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
        <form className="flex flex-col gap-4" onSubmit={handleCreateInvitation}>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="invite-email">Email</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="new-user@example.com"
                aria-invalid={!!error}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <NativeSelect
                id="invite-role"
                value={role}
                onChange={(event) => {
                  setRole(event.target.value === 'admin' ? 'admin' : 'member')
                }}
              >
                <NativeSelectOption value="member">Member</NativeSelectOption>
                <NativeSelectOption value="admin">Admin</NativeSelectOption>
              </NativeSelect>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? 'Generating...' : 'Generate invite URL'}
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
