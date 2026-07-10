import type { TeamMemberRow } from './team-member-row'

import { IconPlus, IconSearch } from '@tabler/icons-react'
import {
  createOrganizationInvitation,
  listOrganizationInvitationsQueryKey,
  revokeOrganizationInvitation,
  useListOrganizationInvitations,
  useListOrganizationMembers,
} from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@talelabs/ui/components/input-group'
import { Separator } from '@talelabs/ui/components/separator'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [memberSearch, setMemberSearch] = useState('')
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
      .filter(invitation => invitation.status === 'pending')
      .map((invitation): TeamMemberRow => ({
        createdAt: invitation.createdAt,
        email: invitation.email,
        id: `invitation:${invitation.id}`,
        inviteUrl: invitation.inviteUrl,
        name: t('team.invitedUser'),
        role: invitation.role,
        sourceId: invitation.id,
        status: 'pending',
      }))

    return [...memberRows, ...pendingInvitationRows]
  }, [invitations, members, t])
  const isLoading = membersQuery.isLoading || invitationsQuery.isLoading
  const isError = membersQuery.isError || invitationsQuery.isError

  async function handleCopyInviteLink(row: TeamMemberRow) {
    if (!row.inviteUrl)
      return

    await navigator.clipboard?.writeText(row.inviteUrl)
    toast.success(t('team.invitationCopied'))
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
      toast.success(t('team.invitationResent'))
    }
    catch (caughtError) {
      const message = getApiErrorMessage(
        caughtError,
        'team.couldNotResendInvitation',
      )
      toast.error(message)
    }
  }

  async function handleRevokeInvite(row: TeamMemberRow) {
    if (!activeOrganizationId)
      return

    try {
      await revokeOrganizationInvitation({
        organizationId: activeOrganizationId,
        invitationId: row.sourceId,
      })
      await queryClient.invalidateQueries({
        queryKey: listOrganizationInvitationsQueryKey({
          organizationId: activeOrganizationId,
        }),
      })
      toast.success(t('team.invitationRevoked'))
    }
    catch (caughtError) {
      const message = getApiErrorMessage(
        caughtError,
        'team.couldNotRevokeInvitation',
      )
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 pr-12 pb-4">
        <h2 className="text-lg font-semibold">{t('team.title')}</h2>
        {activeOrganizationId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onInviteFormOpenChange(!isInviteFormOpen)}
          >
            <IconPlus />
            {t('team.inviteUser')}
          </Button>
        )}
      </header>
      <Separator className="mb-5" />
      {!activeOrganizationId && (
        <p className="text-sm text-muted-foreground">
          {t('organizations.noActive')}
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
              {t('team.adminOnlyMembers')}
            </p>
          )}
          {!isError && (
            <>
              <InputGroup className="max-w-sm">
                <InputGroupAddon>
                  <IconSearch />
                </InputGroupAddon>
                <InputGroupInput
                  value={memberSearch}
                  onChange={event => setMemberSearch(event.target.value)}
                  placeholder={t('team.searchPlaceholder')}
                  aria-label={t('team.search')}
                />
              </InputGroup>
              <TeamMembersTable
                emptyMessage={memberSearch.trim()
                  ? t('team.noSearchResults')
                  : t('team.noMembers')}
                isLoading={isLoading}
                rows={rows}
                searchValue={memberSearch}
                onCopyInviteLink={(row) => {
                  void handleCopyInviteLink(row)
                }}
                onResendInvite={(row) => {
                  void handleResendInvite(row)
                }}
                onRevokeInvite={(row) => {
                  void handleRevokeInvite(row)
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
