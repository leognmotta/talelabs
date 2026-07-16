/** Better Auth session loading and active-organization persistence. */

import type { SessionWithOrganization } from './auth-types.js'

import { db } from '@talelabs/db'
import { auth } from './auth-config.js'

/** Loads one Better Auth session from request headers. */
export async function getSession(headers: Headers) {
  return await auth.api.getSession({ headers }) as SessionWithOrganization | null
}

/** Persists the active organization selected for a session. */
export async function setActiveOrganizationId(
  sessionToken: string,
  organizationId: string,
) {
  await db
    .updateTable('session')
    .set({ activeOrganizationId: organizationId, updatedAt: new Date() })
    .where('token', '=', sessionToken)
    .execute()
}

/** Clears an inaccessible active organization from a session. */
export async function clearActiveOrganizationId(sessionToken: string) {
  await db
    .updateTable('session')
    .set({ activeOrganizationId: null, updatedAt: new Date() })
    .where('token', '=', sessionToken)
    .execute()
}
