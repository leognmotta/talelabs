/** Database-backed organization existence, membership, and role checks. */

import { db } from '@talelabs/db'

/** Returns whether an organization exists. */
export async function organizationExists(organizationId: string) {
  const organization = await db
    .selectFrom('organization')
    .select('id')
    .where('id', '=', organizationId)
    .executeTakeFirst()
  return Boolean(organization)
}

/** Returns whether a user belongs to an organization. */
export async function isOrganizationMember(
  userId: string,
  organizationId: string,
) {
  const member = await db
    .selectFrom('member')
    .select('id')
    .where('userId', '=', userId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return Boolean(member)
}

/** Reads a user's organization role, or null when no membership exists. */
export async function getOrganizationMemberRole(
  userId: string,
  organizationId: string,
) {
  const member = await db
    .selectFrom('member')
    .select('role')
    .where('userId', '=', userId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return member?.role ?? null
}
