/** Better Auth user, session, account, and organization table contracts. */

import type {
  GeneratedTimestamp,
  Timestamp,
} from './column-types.js'

/** Better Auth user table contract. */
export interface UserTable {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  banned: boolean
  banReason: string | null
  banExpires: Timestamp | null
  locale: string | null
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Better Auth session table contract. */
export interface SessionTable {
  id: string
  expiresAt: Timestamp
  token: string
  createdAt: GeneratedTimestamp
  updatedAt: Timestamp
  ipAddress: string | null
  userAgent: string | null
  userId: string
  activeOrganizationId: string | null
  impersonatedBy: string | null
}

/** Better Auth linked-account table contract. */
export interface AccountTable {
  id: string
  accountId: string
  providerId: string
  userId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  accessTokenExpiresAt: Timestamp | null
  refreshTokenExpiresAt: Timestamp | null
  scope: string | null
  password: string | null
  createdAt: GeneratedTimestamp
  updatedAt: Timestamp
}

/** Better Auth verification-token table contract. */
export interface VerificationTable {
  id: string
  identifier: string
  value: string
  expiresAt: Timestamp
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

/** Better Auth organization table contract. */
export interface OrganizationTable {
  id: string
  name: string
  slug: string
  logo: string | null
  createdAt: Timestamp
  metadata: string | null
}

/** Better Auth organization membership table contract. */
export interface MemberTable {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Timestamp
}

/** Better Auth organization invitation table contract. */
export interface InvitationTable {
  id: string
  organizationId: string
  email: string
  role: string | null
  status: string
  expiresAt: Timestamp
  createdAt: GeneratedTimestamp
  inviterId: string
}
