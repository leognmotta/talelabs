/** Organization-administrator authorization shared by invitation services. */

import {
  getOrganizationMemberRole,
  organizationExists,
} from './organization-access-data.js'
import { ORGANIZATION_ADMIN_ROLE } from './organization-roles.js'
import { requireSession } from './session-resolution.js'
import { isSystemAdminRole } from './system-admin-roles.js'

function isOrganizationAdminRole(role: string | null | undefined) {
  const roles = (role ?? '').split(',').map(part => part.trim())
  return roles.includes(ORGANIZATION_ADMIN_ROLE) || roles.includes('owner')
}

/** Requires system or organization administration for one organization. */
export async function requireInvitationAccess(
  headers: Headers,
  organizationId: string,
) {
  const sessionResult = await requireSession(headers)
  if (!sessionResult.ok)
    return sessionResult
  const { session } = sessionResult
  const isSystemAdmin = isSystemAdminRole(session.user.role)
  if (isSystemAdmin && await organizationExists(organizationId)) {
    return { ok: true, session, isSystemAdmin } as const
  }
  const role = await getOrganizationMemberRole(session.user.id, organizationId)
  if (!isOrganizationAdminRole(role)) {
    return {
      ok: false,
      status: 403,
      error: 'Organization admin required',
    } as const
  }
  return { ok: true, session, isSystemAdmin } as const
}
