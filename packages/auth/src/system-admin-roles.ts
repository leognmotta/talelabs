/** System-level roles that may administer every TaleLabs organization. */

/** Standard system administrator role. */
export const SYSTEM_ADMIN_ROLE = 'system_admin'
/** Elevated system super-administrator role. */
export const SYSTEM_SUPER_ADMIN_ROLE = 'system_super_admin'

/** Complete allowlist of system-level administrator roles. */
export const SYSTEM_ADMIN_ROLES = [
  SYSTEM_ADMIN_ROLE,
  SYSTEM_SUPER_ADMIN_ROLE,
] as const

function roleParts(role: string | null | undefined) {
  return (role ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

/** Returns whether a Better Auth user role grants system administration. */
export function isSystemAdminRole(role: string | null | undefined) {
  const roles = roleParts(role)
  return SYSTEM_ADMIN_ROLES.some(systemRole => roles.includes(systemRole))
}
