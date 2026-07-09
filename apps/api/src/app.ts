import { swaggerUI } from '@hono/swagger-ui'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  activateOrganizationSession,
  auth,
  createOrganizationInvitation,
  listAccessibleOrganizations,
  listOrganizationInvitations,
  requireOrganizationSession,
} from '@talelabs/auth'
import { db, sql } from '@talelabs/db'
import { cors } from 'hono/cors'

const app = new OpenAPIHono()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: (_origin, c) => {
      const requestedMethod = c.req.header('Access-Control-Request-Method')

      return requestedMethod
        ? [requestedMethod]
        : ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    },
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }),
)

app.on(['GET', 'POST'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

const HealthResponseSchema = z.object({
  ok: z.boolean().openapi({ example: true }),
}).openapi('HealthResponse')

const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: 'Authentication required' }),
}).openapi('ErrorResponse')

const MeResponseSchema = z.object({
  activeOrganizationId: z.string().openapi({
    example: 'org_123',
  }),
  isSystemAdmin: z.boolean().openapi({ example: false }),
  session: z.object({
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    id: z.string(),
  }),
  user: z.object({
    email: z.email().openapi({ example: 'mail@leomotta.me' }),
    id: z.string().openapi({ example: 'user_123' }),
    name: z.string().openapi({ example: 'Leonardo Motta' }),
  }),
}).openapi('MeResponse')

const OrganizationSchema = z.object({
  id: z.string().openapi({ example: 'org_123' }),
  name: z.string().openapi({ example: 'Acme Inc' }),
  slug: z.string().openapi({ example: 'acme-inc' }),
  logo: z.string().nullable().openapi({ example: null }),
  role: z.string().nullable().openapi({ example: 'admin' }),
  isSystemAdminAccess: z.boolean().openapi({ example: false }),
}).openapi('Organization')

const InvitationSchema = z.object({
  id: z.string().openapi({ example: 'invite_123' }),
  organizationId: z.string().openapi({ example: 'org_123' }),
  email: z.email().openapi({ example: 'new-user@example.com' }),
  role: z.enum(['admin', 'member']).openapi({ example: 'member' }),
  status: z.string().openapi({ example: 'pending' }),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  inviteUrl: z.url().openapi({
    example: 'http://localhost:5173/accept-invitation?token=invite_123',
  }),
}).openapi('Invitation')

const ListOrganizationsResponseSchema = z.object({
  organizations: z.array(OrganizationSchema),
}).openapi('ListOrganizationsResponse')

const ActivateOrganizationResponseSchema = z.object({
  organization: OrganizationSchema,
}).openapi('ActivateOrganizationResponse')

const ListInvitationsResponseSchema = z.object({
  invitations: z.array(InvitationSchema),
}).openapi('ListInvitationsResponse')

const CreateInvitationRequestSchema = z.object({
  email: z.email().openapi({ example: 'new-user@example.com' }),
  role: z.enum(['admin', 'member']).default('member').openapi({ example: 'member' }),
  resend: z.boolean().optional().openapi({ example: false }),
}).openapi('CreateInvitationRequest')

const CreateInvitationResponseSchema = z.object({
  invitation: InvitationSchema,
}).openapi('CreateInvitationResponse')

function toInvitationRole(role: string): 'admin' | 'member' {
  return role === 'admin' ? 'admin' : 'member'
}

const healthRoute = createRoute({
  method: 'get',
  path: '/db/health',
  operationId: 'getDbHealth',
  tags: ['System'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'Database connection health',
    },
  },
})

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  operationId: 'getMe',
  tags: ['Account'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeResponseSchema,
        },
      },
      description: 'Authenticated user and active organization session',
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
      description: 'Active organization required',
    },
  },
})

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
  },
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.openapi(healthRoute, async (c) => {
  const result = await sql<{ ok: number }>`select 1 as ok`.execute(db)
  const ok = result.rows[0]?.ok === 1

  return c.json({ ok })
})

app.openapi(meRoute, async (c) => {
  const result = await requireOrganizationSession(c.req.raw.headers)

  if (!result.ok && result.status === 401)
    return c.json({ error: result.error }, 401)

  if (!result.ok)
    return c.json({ error: result.error }, 403)

  return c.json({
    activeOrganizationId: result.activeOrganizationId,
    isSystemAdmin: Boolean(result.session.user.role?.split(',').map(role => role.trim()).includes('system_admin')),
    session: {
      id: result.session.session.id,
      createdAt: result.session.session.createdAt.toISOString(),
      expiresAt: result.session.session.expiresAt.toISOString(),
    },
    user: {
      id: result.session.user.id,
      email: result.session.user.email,
      name: result.session.user.name,
    },
  }, 200)
})

app.openapi(listOrganizationsRoute, async (c) => {
  const result = await listAccessibleOrganizations(c.req.raw.headers)

  if (!result.ok)
    return c.json({ error: result.error }, 401)

  return c.json({ organizations: result.organizations }, 200)
})

app.openapi(activateOrganizationRoute, async (c) => {
  const { organizationId } = c.req.valid('param')
  const result = await activateOrganizationSession(c.req.raw.headers, organizationId)

  if (!result.ok && result.status === 401)
    return c.json({ error: result.error }, 401)

  if (!result.ok)
    return c.json({ error: result.error }, 403)

  return c.json({ organization: result.organization }, 200)
})

app.openapi(listInvitationsRoute, async (c) => {
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

app.openapi(createInvitationRoute, async (c) => {
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

app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'TaleLabs API',
    version: '0.1.0',
    description: 'Organization-first TaleLabs API',
  },
  servers: [
    {
      url: 'http://localhost:5174',
      description: 'Local API',
    },
  ],
})

app.get('/docs', swaggerUI({ url: '/openapi.json' }))

export default app
