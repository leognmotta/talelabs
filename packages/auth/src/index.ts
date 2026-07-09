import { db } from '@talelabs/db'
import { betterAuth } from 'better-auth'
import { organization } from 'better-auth/plugins'

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.DASHBOARD_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
].filter((origin): origin is string => Boolean(origin))

export const auth = betterAuth({
  appName: 'TaleLabs',
  database: {
    db,
    type: 'postgres',
  },
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins,
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
    }),
  ],
})

type SessionWithOrganization = typeof auth.$Infer.Session & {
  session: typeof auth.$Infer.Session.session & {
    activeOrganizationId?: string | null
  }
}

export async function requireOrganizationSession(headers: Headers) {
  const session = await auth.api.getSession({ headers }) as SessionWithOrganization | null
  const activeOrganizationId = session?.session.activeOrganizationId

  if (!session) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required',
    } as const
  }

  if (!activeOrganizationId) {
    return {
      ok: false,
      status: 403,
      error: 'Active organization required',
    } as const
  }

  return {
    ok: true,
    session,
    activeOrganizationId,
  } as const
}

export type AuthSession = typeof auth.$Infer.Session
