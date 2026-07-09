import type { ColumnType } from 'kysely'

type Timestamp = ColumnType<Date, Date | string, Date | string>
type GeneratedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>

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
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

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

export interface VerificationTable {
  id: string
  identifier: string
  value: string
  expiresAt: Timestamp
  createdAt: GeneratedTimestamp
  updatedAt: GeneratedTimestamp
}

export interface OrganizationTable {
  id: string
  name: string
  slug: string
  logo: string | null
  createdAt: Timestamp
  metadata: string | null
}

export interface MemberTable {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Timestamp
}

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

export interface Database {
  account: AccountTable
  invitation: InvitationTable
  member: MemberTable
  organization: OrganizationTable
  session: SessionTable
  user: UserTable
  verification: VerificationTable
}
