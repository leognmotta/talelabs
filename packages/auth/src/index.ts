/**
 * TaleLabs Better Auth configuration and organization access services.
 * @packageDocumentation
 */

export { auth } from './auth-config.js'

export type { AuthSession } from './auth-types.js'
export {
  listOrganizationMembers,
  updateOrganizationMetadata,
} from './organization-administration.js'
export {
  activateOrganizationSession,
  listAccessibleOrganizations,
} from './organization-directory.js'
export {
  createOrganizationInvitation,
  listOrganizationInvitations,
  revokeOrganizationInvitation,
} from './organization-invitations.js'
export * from './organization-roles.js'
export { requireOrganizationSession } from './session-resolution.js'
export * from './system-admin-roles.js'
