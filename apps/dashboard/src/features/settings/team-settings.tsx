import type { TeamMemberRow } from './team-member-row'

import { IconPlus } from '@tabler/icons-react'
import {
  createOrganizationInvitation,
  listOrganizationInvitationsQueryKey,
  useListOrganizationInvitations,
  useListOrganizationMembers,
} from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { TeamInvitationForm } from './team-invitation-form'
import { TeamMembersTable } from './team-members-table'

export function TeamSettings({
  activeOrganizationId,
  isInviteFormOpen,
  onInviteFormOpenChange,
}: {
  activeOrganizationId: string | null
  isInviteFormOpen: boolean
  onInviteFormOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const organizationId = activeOrganizationId ?? undefined
  const membersQuery = useListOrganizationMembers(
    { organizationId },
    {
      query: {
        retry: false,
      },
    },
  )
  const invitationsQuery = useListOrganizationInvitations(
    { organizationId },
    {
      query: {
        retry: false,
      },
    },
  )
  const members = useMemo(
    () => membersQuery.data?.members ?? [],
    [membersQuery.data],
  )
  const invitations = useMemo(
    () => invitationsQuery.data?.invitations ?? [],
    [invitationsQuery.data],
  )
  const rows = useMemo(() => {
    const memberRows = members.map((member): TeamMemberRow => ({
      createdAt: member.createdAt,
      email: member.email,
      id: `member:${member.id}`,
      name: member.name,
      role: member.role,
      sourceId: member.id,
      status: 'active',
    }))
    const pendingInvitationRows = invitations
      .filter(invitation => invitation.status !== 'accepted')
      .map((invitation): TeamMemberRow => ({
        createdAt: invitation.createdAt,
        email: invitation.email,
        id: `invitation:${invitation.id}`,
        inviteUrl: invitation.inviteUrl,
        name: 'Invited user',
        role: invitation.role,
        sourceId: invitation.id,
        status: 'pending',
      }))

    return [...memberRows, ...pendingInvitationRows]
  }, [invitations, members])
  const isLoading = membersQuery.isLoading || invitationsQuery.isLoading
  const isError = membersQuery.isError || invitationsQuery.isError

  async function handleCopyInviteLink(row: TeamMemberRow) {
    if (!row.inviteUrl)
      return

    await navigator.clipboard?.writeText(row.inviteUrl)
    toast.success('Invitation URL copied')
  }

  async function handleResendInvite(row: TeamMemberRow) {
    if (!activeOrganizationId)
      return

    try {
      await createOrganizationInvitation({
        organizationId: activeOrganizationId,
        data: {
          email: row.email,
          role: row.role,
          resend: true,
        },
      })
      await queryClient.invalidateQueries({
        queryKey: listOrganizationInvitationsQueryKey({
          organizationId: activeOrganizationId,
        }),
      })
      toast.success('Invitation email resent')
    }
    catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Could not resend invitation.'
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 pr-12 pb-4">
        <h2 className="text-lg font-semibold">Team</h2>
        {activeOrganizationId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onInviteFormOpenChange(!isInviteFormOpen)}
          >
            <IconPlus />
            Invite user
          </Button>
        )}
      </header>
      <Separator className="mb-5" />
      {!activeOrganizationId && (
        <p className="text-sm text-muted-foreground">
          No active organization.
        </p>
      )}
      {activeOrganizationId && (
        <div className="flex flex-col gap-5">
          {isInviteFormOpen && (
            <TeamInvitationForm
              organizationId={activeOrganizationId}
              onInvitationCreated={() => onInviteFormOpenChange(false)}
            />
          )}
          {isError && (
            <p className="text-sm text-muted-foreground">
              Organization admins can view members and invitations.
            </p>
          )}
          {!isError && (
            <TeamMembersTable
              isLoading={isLoading}
              rows={rows}
              onCopyInviteLink={(row) => {
                void handleCopyInviteLink(row)
              }}
              onResendInvite={(row) => {
                void handleResendInvite(row)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
