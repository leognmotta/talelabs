/** Organization listing and active-session switching services. */

import type { OrganizationSummary } from './auth-types.js'

import { db } from '@talelabs/db'
import {
  getOrganizationMemberRole,
  isOrganizationMember,
  organizationExists,
} from './organization-access-data.js'
import { requireSession } from './session-resolution.js'
import {
  clearActiveOrganizationId,
  setActiveOrganizationId,
} from './session-store.js'
import { isSystemAdminRole } from './system-admin-roles.js'

/** Lists organizations accessible through membership or system administration. */
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

/** Activates an organization after membership or system-admin authorization. */
export async function activateOrganizationSession(
  headers: Headers,
  organizationId: string,
) {
  const sessionResult = await requireSession(headers)
  if (!sessionResult.ok)
    return sessionResult
  const { session } = sessionResult
  const isSystemAdmin = isSystemAdminRole(session.user.role)
  const canAccess = isSystemAdmin
    ? await organizationExists(organizationId)
    : await isOrganizationMember(session.user.id, organizationId)
  if (!canAccess) {
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
