/** TaleLabs Better Auth server configuration and plugin registration. */

import { db } from '@talelabs/db'
import { validateEmailConfiguration } from '@talelabs/email/config'
import { betterAuth } from 'better-auth'
import { admin, organization } from 'better-auth/plugins'
import { defaultRoles as adminDefaultRoles } from 'better-auth/plugins/admin/access'
import { defaultRoles as organizationDefaultRoles } from 'better-auth/plugins/organization/access'
import * as organizationRoles from './organization-roles.js'
import * as systemRoles from './system-admin-roles.js'

validateEmailConfiguration()

const trustedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.DASHBOARD_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
].filter((origin): origin is string => Boolean(origin))

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

/** Configured TaleLabs Better Auth server instance. */
export const auth = betterAuth({
  appName: 'TaleLabs',
  database: {
    db,
    type: 'postgres',
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      locale: {
        type: 'string',
        required: false,
      },
    },
  },
  socialProviders: googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : undefined,
  trustedOrigins,
  plugins: [
    admin({
      adminRoles: [...systemRoles.SYSTEM_ADMIN_ROLES],
      defaultRole: 'user',
      roles: {
        [systemRoles.SYSTEM_ADMIN_ROLE]: adminDefaultRoles.admin,
        [systemRoles.SYSTEM_SUPER_ADMIN_ROLE]: adminDefaultRoles.admin,
        user: adminDefaultRoles.user,
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
      cancelPendingInvitationsOnReInvite: true,
      creatorRole: organizationRoles.ORGANIZATION_ADMIN_ROLE,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      organizationLimit: 10,
      roles: {
        [organizationRoles.ORGANIZATION_ADMIN_ROLE]: organizationDefaultRoles.admin,
        [organizationRoles.ORGANIZATION_MEMBER_ROLE]: organizationDefaultRoles.member,
      },
    }),
  ],
})
