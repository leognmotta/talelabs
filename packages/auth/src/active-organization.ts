/** Deterministic active-organization selection for authenticated sessions. */

import type { SessionWithOrganization } from './auth-types.js'

import { db } from '@talelabs/db'
import {
  isOrganizationMember,
  organizationExists,
} from './organization-access-data.js'
import { LAST_ORGANIZATION_COOKIE } from './organization-roles.js'
import { isSystemAdminRole } from './system-admin-roles.js'

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

async function getFirstOrganizationIdForUser(
  userId: string,
  isSystemAdmin: boolean,
) {
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

/** Resolves a valid active organization from cookie, session, or first access. */
export async function resolveActiveOrganization(
  session: SessionWithOrganization,
  headers: Headers,
) {
  const isSystemAdmin = isSystemAdminRole(session.user.role)
  const cookieOrganizationId = parseCookie(
    headers.get('cookie'),
    LAST_ORGANIZATION_COOKIE,
  )
  const candidates = [
    cookieOrganizationId,
    session.session.activeOrganizationId,
  ].filter((organizationId): organizationId is string => Boolean(organizationId))
  for (const organizationId of candidates) {
    const canAccess = isSystemAdmin
      ? await organizationExists(organizationId)
      : await isOrganizationMember(session.user.id, organizationId)
    if (canAccess)
      return organizationId
  }
  return await getFirstOrganizationIdForUser(session.user.id, isSystemAdmin)
}
