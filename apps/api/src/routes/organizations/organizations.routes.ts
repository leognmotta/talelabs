import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute, z } from '@hono/zod-openapi'
import {
  activateOrganizationSession,
  createOrganizationInvitation,
  listAccessibleOrganizations,
  listOrganizationInvitations,
  listOrganizationMembers,
  revokeOrganizationInvitation,
} from '@talelabs/auth'
import { requireAuth } from '../../middleware/auth.js'
import { ErrorResponseSchema } from '../../schemas/common.js'
import {
  ActivateOrganizationResponseSchema,
  CreateInvitationRequestSchema,
  CreateInvitationResponseSchema,
  ListInvitationsResponseSchema,
  ListOrganizationMembersResponseSchema,
  ListOrganizationsResponseSchema,
  RevokeInvitationResponseSchema,
} from './organizations.schemas.js'

function toInvitationRole(role: string): 'admin' | 'member' {
  return role === 'admin' ? 'admin' : 'member'
}

function toOrganizationRole(role: string): 'admin' | 'member' {
  return role === 'admin' ? 'admin' : 'member'
}

const listOrganizationsRoute = createRoute({
  method: 'get',
  path: '/organizations',
  operationId: 'listOrganizations',
  tags: ['Organizations'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListOrganizationsResponseSchema,
        },
      },
      description: 'Organizations available to the current user',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
  },
})

const activateOrganizationRoute = createRoute({
  method: 'post',
  path: '/organizations/{organizationId}/activate',
  operationId: 'activateOrganization',
  tags: ['Organizations'],
  request: {
    params: z.object({
      organizationId: z.string().openapi({ example: 'org_123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ActivateOrganizationResponseSchema,
        },
      },
      description: 'Activated organization session',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization access required',
    },
  },
})

const listInvitationsRoute = createRoute({
  method: 'get',
  path: '/organizations/{organizationId}/invitations',
  operationId: 'listOrganizationInvitations',
  tags: ['Invitations'],
  request: {
    params: z.object({
      organizationId: z.string().openapi({ example: 'org_123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListInvitationsResponseSchema,
        },
      },
      description: 'Organization invitations',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization admin required',
    },
  },
})

const listOrganizationMembersRoute = createRoute({
  method: 'get',
  path: '/organizations/{organizationId}/members',
  operationId: 'listOrganizationMembers',
  tags: ['Organizations'],
  request: {
    params: z.object({
      organizationId: z.string().openapi({ example: 'org_123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ListOrganizationMembersResponseSchema,
        },
      },
      description: 'Organization members',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization admin required',
    },
  },
})

const createInvitationRoute = createRoute({
  method: 'post',
  path: '/organizations/{organizationId}/invitations',
  operationId: 'createOrganizationInvitation',
  tags: ['Invitations'],
  request: {
    params: z.object({
      organizationId: z.string().openapi({ example: 'org_123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateInvitationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: CreateInvitationResponseSchema,
        },
      },
      description: 'Generated invitation token and URL',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization admin required',
    },
    409: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Pending invitation already exists',
    },
    502: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invitation email could not be sent',
    },
  },
})

const revokeInvitationRoute = createRoute({
  method: 'delete',
  path: '/organizations/{organizationId}/invitations/{invitationId}',
  operationId: 'revokeOrganizationInvitation',
  tags: ['Invitations'],
  request: {
    params: z.object({
      organizationId: z.string().openapi({ example: 'org_123' }),
      invitationId: z.string().openapi({ example: 'invite_123' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: RevokeInvitationResponseSchema,
        },
      },
      description: 'Revoked organization invitation',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization admin required',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Pending invitation not found',
    },
  },
})

export function registerOrganizationRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listOrganizationsRoute, async (c) => {
    requireAuth(c)

    const result = await listAccessibleOrganizations(c.req.raw.headers)

    if (!result.ok)
      return c.json({ error: result.error }, 401)

    return c.json({ organizations: result.organizations }, 200)
  })

  app.openapi(activateOrganizationRoute, async (c) => {
    requireAuth(c)

    const { organizationId } = c.req.valid('param')
    const result = await activateOrganizationSession(c.req.raw.headers, organizationId)

    if (!result.ok && result.status === 401)
      return c.json({ error: result.error }, 401)

    if (!result.ok)
      return c.json({ error: result.error }, 403)

    return c.json({ organization: result.organization }, 200)
  })

  app.openapi(listInvitationsRoute, async (c) => {
    requireAuth(c)

    const { organizationId } = c.req.valid('param')
    const result = await listOrganizationInvitations(c.req.raw.headers, organizationId)

    if (!result.ok && result.status === 401)
      return c.json({ error: result.error }, 401)

    if (!result.ok)
      return c.json({ error: result.error }, 403)

    return c.json({
      invitations: result.invitations.map(invitation => ({
        ...invitation,
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        role: toInvitationRole(invitation.role),
      })),
    }, 200)
  })

  app.openapi(listOrganizationMembersRoute, async (c) => {
    requireAuth(c)

    const { organizationId } = c.req.valid('param')
    const result = await listOrganizationMembers(c.req.raw.headers, organizationId)

    if (!result.ok && result.status === 401)
      return c.json({ error: result.error }, 401)

    if (!result.ok)
      return c.json({ error: result.error }, 403)

    return c.json({
      members: result.members.map(member => ({
        ...member,
        createdAt: member.createdAt.toISOString(),
        role: toOrganizationRole(member.role),
      })),
    }, 200)
  })

  app.openapi(createInvitationRoute, async (c) => {
    requireAuth(c)

    const { organizationId } = c.req.valid('param')
    const body = c.req.valid('json')
    const result = await createOrganizationInvitation(c.req.raw.headers, {
      organizationId,
      email: body.email,
      role: body.role,
      resend: body.resend,
    })

    if (!result.ok && result.status === 401)
      return c.json({ error: result.error }, 401)

    if (!result.ok && result.status === 409)
      return c.json({ error: result.error }, 409)

    if (!result.ok && result.status === 502)
      return c.json({ error: result.error }, 502)

    if (!result.ok)
      return c.json({ error: result.error }, 403)

    return c.json({
      invitation: {
        ...result.invitation,
        createdAt: result.invitation.createdAt.toISOString(),
        expiresAt: result.invitation.expiresAt.toISOString(),
        role: toInvitationRole(result.invitation.role),
      },
    }, 201)
  })

  app.openapi(revokeInvitationRoute, async (c) => {
    requireAuth(c)

    const { invitationId, organizationId } = c.req.valid('param')
    const result = await revokeOrganizationInvitation(c.req.raw.headers, {
      invitationId,
      organizationId,
    })

    if (!result.ok && result.status === 401)
      return c.json({ error: result.error }, 401)

    if (!result.ok && result.status === 404)
      return c.json({ error: result.error }, 404)

    if (!result.ok)
      return c.json({ error: result.error }, 403)

    return c.json({
      invitation: {
        ...result.invitation,
        createdAt: result.invitation.createdAt.toISOString(),
        expiresAt: result.invitation.expiresAt.toISOString(),
        role: toInvitationRole(result.invitation.role),
      },
    }, 200)
  })
}
