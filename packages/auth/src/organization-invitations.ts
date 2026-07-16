/** Organization invitation listing, revocation, creation, and email delivery. */

import type { InvitationSummary } from './auth-types.js'

import { randomUUID } from 'node:crypto'
import { db } from '@talelabs/db'
import { sendUserInvitationEmail } from '@talelabs/email'
import { requireInvitationAccess } from './invitation-authorization.js'
import { buildInviteUrl } from './invitation-url.js'
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_MEMBER_ROLE,
} from './organization-roles.js'

/** Lists pending and historical invitations for an authorized organization. */
export async function listOrganizationInvitations(
  headers: Headers,
  organizationId: string,
) {
  const accessResult = await requireInvitationAccess(headers, organizationId)
  if (!accessResult.ok)
    return accessResult
  const invitations = await db
    .selectFrom('invitation')
    .select([
      'id',
      'organizationId',
      'email',
      'role',
      'status',
      'expiresAt',
      'createdAt',
    ])
    .where('organizationId', '=', organizationId)
    .orderBy('createdAt', 'desc')
    .execute()
  return {
    ok: true,
    invitations: invitations.map((invitation): InvitationSummary => ({
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role ?? ORGANIZATION_MEMBER_ROLE,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      inviteUrl: buildInviteUrl(invitation.id),
    })),
  } as const
}

/** Revokes a pending organization invitation. */
export async function revokeOrganizationInvitation(
  headers: Headers,
  input: {
    invitationId: string
    organizationId: string
  },
) {
  const accessResult = await requireInvitationAccess(headers, input.organizationId)
  if (!accessResult.ok)
    return accessResult
  const invitation = await db
    .updateTable('invitation')
    .set({ status: 'canceled' })
    .where('id', '=', input.invitationId)
    .where('organizationId', '=', input.organizationId)
    .where('status', '=', 'pending')
    .returning([
      'id',
      'organizationId',
      'email',
      'role',
      'status',
      'expiresAt',
      'createdAt',
    ])
    .executeTakeFirst()
  if (!invitation) {
    return {
      ok: false,
      status: 404,
      error: 'Pending invitation not found',
    } as const
  }
  return {
    ok: true,
    invitation: {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role ?? ORGANIZATION_MEMBER_ROLE,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      inviteUrl: buildInviteUrl(invitation.id),
    } satisfies InvitationSummary,
  } as const
}

/** Creates or resends an authorized organization invitation. */
export async function createOrganizationInvitation(
  headers: Headers,
  input: {
    email: string
    organizationId: string
    role?: string
    resend?: boolean
  },
) {
  const accessResult = await requireInvitationAccess(headers, input.organizationId)
  if (!accessResult.ok)
    return accessResult
  const email = input.email.trim().toLowerCase()
  const role = input.role === ORGANIZATION_ADMIN_ROLE
    ? ORGANIZATION_ADMIN_ROLE
    : ORGANIZATION_MEMBER_ROLE
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7)
  const organization = await db
    .selectFrom('organization')
    .select(['id', 'name'])
    .where('id', '=', input.organizationId)
    .executeTakeFirst()
  if (!organization) {
    return {
      ok: false,
      status: 404,
      error: 'Organization not found',
    } as const
  }
  if (!input.resend) {
    const pendingInvitation = await db
      .selectFrom('invitation')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('email', '=', email)
      .where('status', '=', 'pending')
      .executeTakeFirst()
    if (pendingInvitation) {
      return {
        ok: false,
        status: 409,
        error: 'User already has a pending invitation',
      } as const
    }
  }
  await db
    .updateTable('invitation')
    .set({ status: 'canceled' })
    .where('organizationId', '=', input.organizationId)
    .where('email', '=', email)
    .where('status', '=', 'pending')
    .execute()
  const invitation = await db
    .insertInto('invitation')
    .values({
      id: randomUUID(),
      organizationId: input.organizationId,
      email,
      role,
      status: 'pending',
      expiresAt,
      createdAt: now,
      inviterId: accessResult.session.user.id,
    })
    .returning([
      'id',
      'organizationId',
      'email',
      'role',
      'status',
      'expiresAt',
      'createdAt',
    ])
    .executeTakeFirstOrThrow()
  const inviteUrl = buildInviteUrl(invitation.id)
  try {
    await sendUserInvitationEmail({
      invitationId: invitation.id,
      invitationUrl: inviteUrl,
      invitedEmail: invitation.email,
      inviterName: accessResult.session.user.name,
      organizationName: organization.name,
      role: invitation.role === ORGANIZATION_ADMIN_ROLE
        ? ORGANIZATION_ADMIN_ROLE
        : ORGANIZATION_MEMBER_ROLE,
      expiresAt: invitation.expiresAt,
    })
  }
  catch (error) {
    await db.deleteFrom('invitation').where('id', '=', invitation.id).execute()
    return {
      ok: false,
      status: 502,
      error: error instanceof Error
        ? error.message
        : 'Could not send invitation email',
    } as const
  }
  return {
    ok: true,
    invitation: {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role ?? ORGANIZATION_MEMBER_ROLE,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      inviteUrl,
    } satisfies InvitationSummary,
  } as const
}
