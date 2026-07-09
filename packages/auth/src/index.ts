import { randomUUID } from 'node:crypto'
import { db } from '@talelabs/db'
import { sendUserInvitationEmail } from '@talelabs/email'
import { betterAuth } from 'better-auth'
import { admin, organization } from 'better-auth/plugins'
import {
  defaultRoles as adminDefaultRoles,
} from 'better-auth/plugins/admin/access'
import {
  defaultRoles as organizationDefaultRoles,
} from 'better-auth/plugins/organization/access'

export const LAST_ORGANIZATION_COOKIE = 'talelabs_last_organization_id'
export const SYSTEM_ADMIN_ROLE = 'system_admin'
export const ORGANIZATION_ADMIN_ROLE = 'admin'
export const ORGANIZATION_MEMBER_ROLE = 'member'

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.DASHBOARD_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
].filter((origin): origin is string => Boolean(origin))

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

export const auth = betterAuth({
  appName: 'TaleLabs',
  database: {
    db,
    type: 'postgres',
  },
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : undefined,
  trustedOrigins,
  plugins: [
    admin({
      adminRoles: [SYSTEM_ADMIN_ROLE],
      defaultRole: 'user',
      roles: {
        [SYSTEM_ADMIN_ROLE]: adminDefaultRoles.admin,
        user: adminDefaultRoles.user,
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
      cancelPendingInvitationsOnReInvite: true,
      creatorRole: ORGANIZATION_ADMIN_ROLE,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      organizationLimit: 10,
      roles: {
        [ORGANIZATION_ADMIN_ROLE]: organizationDefaultRoles.admin,
        [ORGANIZATION_MEMBER_ROLE]: organizationDefaultRoles.member,
      },
    }),
  ],
})

type SessionWithOrganization = typeof auth.$Infer.Session & {
  session: typeof auth.$Infer.Session.session & {
    activeOrganizationId?: string | null
  }
  user: typeof auth.$Infer.Session.user & {
    role?: string | null
  }
}

interface OrganizationSummary {
  id: string
  name: string
  slug: string
  logo: string | null
  role: string | null
  isSystemAdminAccess: boolean
}

interface InvitationSummary {
  id: string
  organizationId: string
  email: string
  role: string
  status: string
  expiresAt: Date
  createdAt: Date
  inviteUrl: string
}

interface OrganizationMemberSummary {
  id: string
  organizationId: string
  userId: string
  name: string
  email: string
  role: string
  createdAt: Date
}

function parseCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader)
    return null

  for (const part of cookieHeader.split(';')) {
    const [key, ...valueParts] = part.trim().split('=')

    if (key === name)
      return decodeURIComponent(valueParts.join('='))
  }

  return null
}

function roleParts(role: string | null | undefined) {
  return (role ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

export function isSystemAdminRole(role: string | null | undefined) {
  return roleParts(role).includes(SYSTEM_ADMIN_ROLE)
}

function isOrganizationAdminRole(role: string | null | undefined) {
  const roles = roleParts(role)

  return roles.includes(ORGANIZATION_ADMIN_ROLE) || roles.includes('owner')
}

function getDashboardUrl() {
  return process.env.DASHBOARD_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
}

function buildInviteUrl(invitationId: string) {
  const url = new URL('/accept-invitation', getDashboardUrl())
  url.searchParams.set('token', invitationId)

  return url.toString()
}

async function getSession(headers: Headers) {
  return await auth.api.getSession({ headers }) as SessionWithOrganization | null
}

async function setActiveOrganizationId(sessionToken: string, organizationId: string) {
  await db
    .updateTable('session')
    .set({
      activeOrganizationId: organizationId,
      updatedAt: new Date(),
    })
    .where('token', '=', sessionToken)
    .execute()
}

async function clearActiveOrganizationId(sessionToken: string) {
  await db
    .updateTable('session')
    .set({
      activeOrganizationId: null,
      updatedAt: new Date(),
    })
    .where('token', '=', sessionToken)
    .execute()
}

async function organizationExists(organizationId: string) {
  const organization = await db
    .selectFrom('organization')
    .select('id')
    .where('id', '=', organizationId)
    .executeTakeFirst()

  return Boolean(organization)
}

async function isOrganizationMember(userId: string, organizationId: string) {
  const member = await db
    .selectFrom('member')
    .select('id')
    .where('userId', '=', userId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  return Boolean(member)
}

async function getOrganizationMemberRole(userId: string, organizationId: string) {
  const member = await db
    .selectFrom('member')
    .select('role')
    .where('userId', '=', userId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  return member?.role ?? null
}

async function getFirstOrganizationIdForUser(userId: string, isSystemAdmin: boolean) {
  if (isSystemAdmin) {
    const organization = await db
      .selectFrom('organization')
      .select('id')
      .orderBy('createdAt', 'asc')
      .executeTakeFirst()

    return organization?.id ?? null
  }

  const membership = await db
    .selectFrom('member')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .select('organization.id as id')
    .where('member.userId', '=', userId)
    .orderBy('organization.createdAt', 'asc')
    .executeTakeFirst()

  return membership?.id ?? null
}

async function canAccessOrganization(userId: string, organizationId: string, isSystemAdmin: boolean) {
  if (isSystemAdmin)
    return await organizationExists(organizationId)

  return await isOrganizationMember(userId, organizationId)
}

async function resolveActiveOrganization(session: SessionWithOrganization, headers: Headers) {
  const isSystemAdmin = isSystemAdminRole(session.user.role)
  const cookieOrganizationId = parseCookie(headers.get('cookie'), LAST_ORGANIZATION_COOKIE)
  const candidates = [
    cookieOrganizationId,
    session.session.activeOrganizationId,
  ].filter((organizationId): organizationId is string => Boolean(organizationId))

  for (const organizationId of candidates) {
    if (await canAccessOrganization(session.user.id, organizationId, isSystemAdmin))
      return organizationId
  }

  return await getFirstOrganizationIdForUser(session.user.id, isSystemAdmin)
}

async function requireSession(headers: Headers) {
  const session = await getSession(headers)

  if (!session) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required',
    } as const
  }

  return {
    ok: true,
    session,
  } as const
}

export async function requireOrganizationSession(headers: Headers) {
  const sessionResult = await requireSession(headers)

  if (!sessionResult.ok)
    return sessionResult

  const { session } = sessionResult
  const activeOrganizationId = await resolveActiveOrganization(session, headers)

  if (!activeOrganizationId) {
    return {
      ok: false,
      status: 403,
      error: 'Active organization required',
    } as const
  }

  if (session.session.activeOrganizationId !== activeOrganizationId)
    await setActiveOrganizationId(session.session.token, activeOrganizationId)

  return {
    ok: true,
    session,
    activeOrganizationId,
  } as const
}

export async function listAccessibleOrganizations(headers: Headers) {
  const sessionResult = await requireSession(headers)

  if (!sessionResult.ok)
    return sessionResult

  const { session } = sessionResult
  const isSystemAdmin = isSystemAdminRole(session.user.role)
  const rows = isSystemAdmin
    ? await db
        .selectFrom('organization')
        .leftJoin('member', join =>
          join
            .onRef('member.organizationId', '=', 'organization.id')
            .on('member.userId', '=', session.user.id))
        .select([
          'organization.id as id',
          'organization.name as name',
          'organization.slug as slug',
          'organization.logo as logo',
          'member.role as role',
        ])
        .orderBy('organization.createdAt', 'asc')
        .execute()
    : await db
        .selectFrom('member')
        .innerJoin('organization', 'organization.id', 'member.organizationId')
        .select([
          'organization.id as id',
          'organization.name as name',
          'organization.slug as slug',
          'organization.logo as logo',
          'member.role as role',
        ])
        .where('member.userId', '=', session.user.id)
        .orderBy('organization.createdAt', 'asc')
        .execute()

  return {
    ok: true,
    organizations: rows.map((row): OrganizationSummary => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      logo: row.logo,
      role: row.role,
      isSystemAdminAccess: isSystemAdmin && !row.role,
    })),
  } as const
}

export async function activateOrganizationSession(headers: Headers, organizationId: string) {
  const sessionResult = await requireSession(headers)

  if (!sessionResult.ok)
    return sessionResult

  const { session } = sessionResult
  const isSystemAdmin = isSystemAdminRole(session.user.role)

  if (!await canAccessOrganization(session.user.id, organizationId, isSystemAdmin)) {
    await clearActiveOrganizationId(session.session.token)

    return {
      ok: false,
      status: 403,
      error: 'Organization access required',
    } as const
  }

  await setActiveOrganizationId(session.session.token, organizationId)

  const organization = await db
    .selectFrom('organization')
    .select(['id', 'name', 'slug', 'logo'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  const role = await getOrganizationMemberRole(session.user.id, organizationId)

  return {
    ok: true,
    organization: {
      ...organization,
      role,
      isSystemAdminAccess: isSystemAdmin && !role,
    } satisfies OrganizationSummary,
  } as const
}

export async function listOrganizationInvitations(headers: Headers, organizationId: string) {
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

export async function listOrganizationMembers(headers: Headers, organizationId: string) {
  const accessResult = await requireInvitationAccess(headers, organizationId)

  if (!accessResult.ok)
    return accessResult

  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .select([
      'member.id as id',
      'member.organizationId as organizationId',
      'member.userId as userId',
      'member.role as role',
      'member.createdAt as createdAt',
      'user.name as name',
      'user.email as email',
    ])
    .where('member.organizationId', '=', organizationId)
    .orderBy('member.createdAt', 'asc')
    .execute()

  return {
    ok: true,
    members: members.map((member): OrganizationMemberSummary => ({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      name: member.name,
      email: member.email,
      role: member.role,
      createdAt: member.createdAt,
    })),
  } as const
}

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

async function requireInvitationAccess(headers: Headers, organizationId: string) {
  const sessionResult = await requireSession(headers)

  if (!sessionResult.ok)
    return sessionResult

  const { session } = sessionResult
  const isSystemAdmin = isSystemAdminRole(session.user.role)

  if (isSystemAdmin && await organizationExists(organizationId)) {
    return {
      ok: true,
      session,
      isSystemAdmin,
    } as const
  }

  const role = await getOrganizationMemberRole(session.user.id, organizationId)

  if (!isOrganizationAdminRole(role)) {
    return {
      ok: false,
      status: 403,
      error: 'Organization admin required',
    } as const
  }

  return {
    ok: true,
    session,
    isSystemAdmin,
  } as const
}

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
    await db
      .deleteFrom('invitation')
      .where('id', '=', invitation.id)
      .execute()

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

export type AuthSession = typeof auth.$Infer.Session
