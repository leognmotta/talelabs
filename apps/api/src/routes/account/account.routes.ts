import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import {
  auth,
  isSystemAdminRole,
  requireOrganizationSession,
} from '@talelabs/auth'
import { normalizeLocale } from '@talelabs/i18n'
import { requireAuth } from '../../middleware/auth.js'
import { apiError } from '../../middleware/error.js'
import { ErrorResponseSchema } from '../../schemas/common.js'
import {
  MeResponseSchema,
  SetPasswordRequestSchema,
  SetPasswordResponseSchema,
  UpdateAccountPreferencesRequestSchema,
  UpdateAccountPreferencesResponseSchema,
} from './account.schemas.js'

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

const setPasswordRoute = createRoute({
  method: 'post',
  path: '/me/password',
  operationId: 'setAccountPassword',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SetPasswordRequestSchema,
        },
      },
      required: true,
    },
  },
  tags: ['Account'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SetPasswordResponseSchema,
        },
      },
      description: 'Password was created for the authenticated account',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Password could not be created',
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

const updateAccountPreferencesRoute = createRoute({
  method: 'patch',
  path: '/me/preferences',
  operationId: 'updateAccountPreferences',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateAccountPreferencesRequestSchema,
        },
      },
      required: true,
    },
  },
  tags: ['Account'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateAccountPreferencesResponseSchema,
        },
      },
      description: 'Account preferences were updated',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Account preferences could not be updated',
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

function getAuthErrorStatus(error: unknown) {
  if (
    error
    && typeof error === 'object'
    && 'statusCode' in error
    && typeof error.statusCode === 'number'
  ) {
    return error.statusCode
  }

  return null
}

function getAuthErrorMessage(error: unknown) {
  if (
    error
    && typeof error === 'object'
    && 'message' in error
    && typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'Could not create password.'
}

export function registerAccountRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(meRoute, async (c) => {
    requireAuth(c)

    const result = await requireOrganizationSession(c.req.raw.headers)

    if (!result.ok && result.status === 401)
      return c.json(apiError('unauthenticated', result.error), 401)

    if (!result.ok)
      return c.json(apiError('active_organization_required', result.error), 403)

    return c.json({
      activeOrganizationId: result.activeOrganizationId,
      isSystemAdmin: isSystemAdminRole(result.session.user.role),
      session: {
        id: result.session.session.id,
        createdAt: result.session.session.createdAt.toISOString(),
        expiresAt: result.session.session.expiresAt.toISOString(),
      },
      user: {
        id: result.session.user.id,
        email: result.session.user.email,
        locale: normalizeLocale(result.session.user.locale ?? ''),
        name: result.session.user.name,
      },
    }, 200)
  })

  app.openapi(updateAccountPreferencesRoute, async (c) => {
    requireAuth(c)

    const body = c.req.valid('json')

    try {
      await auth.api.updateUser({
        body,
        headers: c.req.raw.headers,
      })

      return c.json({ locale: body.locale }, 200)
    }
    catch (error) {
      const status = getAuthErrorStatus(error)

      if (status === 400 || status === 401) {
        return c.json(apiError(
          status === 401 ? 'unauthenticated' : 'validation_error',
          getAuthErrorMessage(error),
        ), status)
      }

      throw error
    }
  })

  app.openapi(setPasswordRoute, async (c) => {
    requireAuth(c)

    const body = c.req.valid('json')

    try {
      await auth.api.setPassword({
        body,
        headers: c.req.raw.headers,
      })

      return c.json({ status: true } as const, 200)
    }
    catch (error) {
      const status = getAuthErrorStatus(error)

      if (status === 400 || status === 401) {
        return c.json(apiError(
          status === 401 ? 'unauthenticated' : 'validation_error',
          getAuthErrorMessage(error),
        ), status)
      }

      throw error
    }
  })
}
