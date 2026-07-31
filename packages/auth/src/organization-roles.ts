/** Stable organization access roles and persistence keys shared by auth services. */

/** Cookie key used to restore the user's last active organization. */
export const LAST_ORGANIZATION_COOKIE = 'talelabs_last_organization_id'

/** Organization role allowed to manage settings, members, and invitations. */
export const ORGANIZATION_ADMIN_ROLE = 'admin'

/** Default organization membership role. */
export const ORGANIZATION_MEMBER_ROLE = 'member'

/** Returns whether a Better Auth organization role can manage billing. */
export function isOrganizationAdminRole(role: string | null | undefined) {
  const roles = (role ?? '').split(',').map(part => part.trim())
  return roles.includes(ORGANIZATION_ADMIN_ROLE) || roles.includes('owner')
}
