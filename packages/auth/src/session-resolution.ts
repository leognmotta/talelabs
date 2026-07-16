/** Authenticated session and active-organization resolution services. */

import { resolveActiveOrganization } from './active-organization.js'
import { getSession, setActiveOrganizationId } from './session-store.js'

/** Requires a valid Better Auth session. */
export async function requireSession(headers: Headers) {
  const session = await getSession(headers)
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required',
    } as const
  }
  return { ok: true, session } as const
}

/** Resolves an authenticated session with a valid active organization. */
export async function requireOrganizationSession(headers: Headers) {
  const sessionResult = await requireSession(headers)
  if (!sessionResult.ok)
    return sessionResult
  const { session } = sessionResult
  const activeOrganizationId = await resolveActiveOrganization(session, headers)
  if (!activeOrganizationId) {
    return {
      ok: false,
      status: 403,
      error: 'Active organization required',
    } as const
  }
  if (session.session.activeOrganizationId !== activeOrganizationId)
    await setActiveOrganizationId(session.session.token, activeOrganizationId)
  return { ok: true, session, activeOrganizationId } as const
}
