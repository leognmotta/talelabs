/** Organization member listing and metadata administration services. */

import type {
  OrganizationMemberSummary,
  OrganizationSummary,
} from './auth-types.js'

import { db } from '@talelabs/db'
import { requireInvitationAccess } from './invitation-authorization.js'
import { getOrganizationMemberRole } from './organization-access-data.js'

/** Lists members for an organization the caller may administer. */
export async function listOrganizationMembers(
  headers: Headers,
  organizationId: string,
) {
  const accessResult = await requireInvitationAccess(headers, organizationId)
  if (!accessResult.ok)
    return accessResult
  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .select([
      'member.id as id',
      'member.organizationId as organizationId',
      'member.userId as userId',
      'member.role as role',
      'member.createdAt as createdAt',
      'user.name as name',
      'user.email as email',
    ])
    .where('member.organizationId', '=', organizationId)
    .orderBy('member.createdAt', 'asc')
    .execute()
  return {
    ok: true,
    members: members.map((member): OrganizationMemberSummary => ({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      name: member.name,
      email: member.email,
      role: member.role,
      createdAt: member.createdAt,
    })),
  } as const
}

/** Updates organization identity metadata after administrative authorization. */
export async function updateOrganizationMetadata(
  headers: Headers,
  input: {
    logo?: null | string
    name: string
    organizationId: string
    slug: string
  },
) {
  const accessResult = await requireInvitationAccess(headers, input.organizationId)
  if (!accessResult.ok)
    return accessResult
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  const logo = input.logo?.trim() || null
  const slugOwner = await db
    .selectFrom('organization')
    .select('id')
    .where('slug', '=', slug)
    .where('id', '!=', input.organizationId)
    .executeTakeFirst()
  if (slugOwner) {
    return {
      ok: false,
      status: 409,
      error: 'Organization slug is already in use',
    } as const
  }
  const organization = await db
    .updateTable('organization')
    .set({ name, slug, logo })
    .where('id', '=', input.organizationId)
    .returning(['id', 'name', 'slug', 'logo'])
    .executeTakeFirst()
  if (!organization) {
    return {
      ok: false,
      status: 404,
      error: 'Organization not found',
    } as const
  }
  const role = await getOrganizationMemberRole(
    accessResult.session.user.id,
    input.organizationId,
  )
  return {
    ok: true,
    organization: {
      ...organization,
      role,
      isSystemAdminAccess: accessResult.isSystemAdmin && !role,
    } satisfies OrganizationSummary,
  } as const
}
