/** Shared inferred auth-session and organization service response shapes. */

import type { auth } from './auth-config.js'

/** Better Auth session extended with organization and system-role fields. */
export type SessionWithOrganization = typeof auth.$Infer.Session & {
  session: typeof auth.$Infer.Session.session & {
    activeOrganizationId?: string | null
  }
  user: typeof auth.$Infer.Session.user & {
    role?: string | null
  }
}

/** Organization list and activation projection returned by auth services. */
export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  logo: string | null
  role: string | null
  isSystemAdminAccess: boolean
}

/** Organization invitation projection with its dashboard acceptance URL. */
export interface InvitationSummary {
  id: string
  organizationId: string
  email: string
  role: string
  status: string
  expiresAt: Date
  createdAt: Date
  inviteUrl: string
}

/** Organization member projection returned by administration services. */
export interface OrganizationMemberSummary {
  id: string
  organizationId: string
  userId: string
  name: string
  email: string
  role: string
  createdAt: Date
}

/** Public session shape inferred from the configured TaleLabs auth instance. */
export type AuthSession = typeof auth.$Infer.Session
