/** Authenticated organization billing API route composition. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { createPublicBillingCatalog } from '@talelabs/billing'

import {
  canManageOrganizationBilling,
  requireOrganizationBillingAdministrator,
  requireSystemBillingAdministrator,
} from '../../domain/billing/authorization.service.js'
import { enrollOrganizationFounder } from '../../domain/billing/founder.service.js'
import {
  getBillingAccountSummary,
  getBillingUsageSummary,
  listBillingLedger,
  listBillingUsageMonths,
} from '../../domain/billing/read.service.js'
import {
  createCustomerPortalSession,
  createSubscriptionCheckout,
  createTopUpCheckout,
} from '../../domain/billing/stripe-checkout.service.js'
import {
  cancelScheduledSubscriptionChange,
} from '../../domain/billing/subscription-change-cancel.service.js'
import {
  previewSubscriptionChange,
  updatePaidSubscription,
} from '../../domain/billing/subscription-change.service.js'
import {
  listBillingUsageRuns,
} from '../../domain/billing/usage-runs.service.js'
import { HttpError } from '../../middleware/error.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  BillingAccountResponseSchema,
  BillingCatalogResponseSchema,
  BillingCheckoutRequestSchema,
  BillingHostedUrlResponseSchema,
  BillingLedgerQuerySchema,
  BillingLedgerResponseSchema,
  BillingSubscriptionChangePreviewResponseSchema,
  BillingSubscriptionChangeRequestSchema,
  BillingSubscriptionScheduleCancelResponseSchema,
  BillingSubscriptionUpdateRequestSchema,
  BillingSubscriptionUpdateResponseSchema,
  BillingTopUpCheckoutRequestSchema,
  BillingUsageMonthsResponseSchema,
  BillingUsageQuerySchema,
  BillingUsageResponseSchema,
  BillingUsageRunsQuerySchema,
  BillingUsageRunsResponseSchema,
} from './billing.schemas.js'

const getCatalogRoute = createRoute({
  method: 'get',
  operationId: 'getBillingCatalog',
  path: '/billing/catalog',
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingCatalogResponseSchema },
      },
      description: 'Current sanitized billing catalog',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const getAccountRoute = createRoute({
  method: 'get',
  operationId: 'getBillingAccount',
  path: '/billing/account',
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingAccountResponseSchema },
      },
      description: 'Current organization billing and quota projection',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const getUsageRoute = createRoute({
  method: 'get',
  operationId: 'getBillingUsage',
  path: '/billing/usage',
  request: { query: BillingUsageQuerySchema },
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingUsageResponseSchema },
      },
      description: 'Organization content and selected-month generation usage',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const getUsageMonthsRoute = createRoute({
  method: 'get',
  operationId: 'getBillingUsageMonths',
  path: '/billing/usage/months',
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingUsageMonthsResponseSchema },
      },
      description: 'Recent months containing generation or credit activity',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const getUsageRunsRoute = createRoute({
  method: 'get',
  operationId: 'getBillingUsageRuns',
  path: '/billing/usage/runs',
  request: { query: BillingUsageRunsQuerySchema },
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingUsageRunsResponseSchema },
      },
      description: 'Selected-month generation run history visible to the member',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const getLedgerRoute = createRoute({
  method: 'get',
  operationId: 'getBillingCreditsLedger',
  path: '/billing/credits/ledger',
  request: { query: BillingLedgerQuerySchema },
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingLedgerResponseSchema },
      },
      description: 'Cursor-paged organization credit ledger',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const createCheckoutRoute = createRoute({
  method: 'post',
  operationId: 'createBillingCheckout',
  path: '/billing/checkout',
  request: {
    body: {
      content: {
        'application/json': { schema: BillingCheckoutRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingHostedUrlResponseSchema },
      },
      description: 'Stripe-hosted subscription Checkout URL',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const updateSubscriptionRoute = createRoute({
  method: 'patch',
  operationId: 'updateBillingSubscription',
  path: '/billing/subscription',
  request: {
    body: {
      content: {
        'application/json': {
          schema: BillingSubscriptionUpdateRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingSubscriptionUpdateResponseSchema },
      },
      description: 'Applied or scheduled paid subscription change',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const previewSubscriptionChangeRoute = createRoute({
  method: 'post',
  operationId: 'previewBillingSubscriptionChange',
  path: '/billing/subscription/preview',
  request: {
    body: {
      content: {
        'application/json': {
          schema: BillingSubscriptionChangeRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: BillingSubscriptionChangePreviewResponseSchema,
        },
      },
      description: 'Exact paid subscription change preview',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const cancelSubscriptionScheduleRoute = createRoute({
  method: 'delete',
  operationId: 'cancelBillingSubscriptionSchedule',
  path: '/billing/subscription/schedule',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: BillingSubscriptionScheduleCancelResponseSchema,
        },
      },
      description: 'Released future subscription change',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const createTopUpCheckoutRoute = createRoute({
  method: 'post',
  operationId: 'createBillingTopUpCheckout',
  path: '/billing/topups/checkout',
  request: {
    body: {
      content: {
        'application/json': { schema: BillingTopUpCheckoutRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingHostedUrlResponseSchema },
      },
      description: 'Stripe-hosted one-time top-up Checkout URL',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const createPortalRoute = createRoute({
  method: 'post',
  operationId: 'createBillingPortal',
  path: '/billing/portal',
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingHostedUrlResponseSchema },
      },
      description: 'Stripe-hosted Customer Portal URL',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

const assignFounderRoute = createRoute({
  method: 'post',
  operationId: 'assignBillingFounderStatus',
  path: '/billing/founder',
  responses: {
    200: {
      content: {
        'application/json': { schema: BillingAccountResponseSchema },
      },
      description: 'Explicit Founder enrollment and one-time welcome grant',
    },
    ...commonErrorResponses,
  },
  tags: ['Billing'],
})

function requireIdempotencyKey(value: string | undefined) {
  const key = value?.trim()
  if (!key || key.length > 255) {
    throw new HttpError(
      400,
      'idempotency_key_required',
      'A valid Idempotency-Key header is required.',
    )
  }
  return key
}

function billingAuthorizationContext(c: {
  var: Pick<ApiEnv['Variables'], 'isSystemAdmin' | 'organizationId' | 'userId'>
}) {
  return {
    isSystemAdmin: c.var.isSystemAdmin,
    organizationId: c.var.organizationId,
    userId: c.var.userId,
  }
}

function setPrivateNoStore(c: { header: (name: string, value: string) => void }) {
  c.header('Cache-Control', 'private, no-store')
}

/** Mounts all authenticated organization Billing routes. */
export function registerBillingRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(getCatalogRoute, async (c) => {
    setPrivateNoStore(c)
    const canManageBilling = await canManageOrganizationBilling(
      billingAuthorizationContext(c),
    )
    const account = await getBillingAccountSummary({
      canManageBilling,
      organizationId: c.var.organizationId,
    })
    return c.json(createPublicBillingCatalog({
      planCode: account.plan.code,
      recurringOptionCode: account.plan.recurringOptionCode,
    }), 200)
  })

  app.openapi(getAccountRoute, async (c) => {
    setPrivateNoStore(c)
    return c.json(await getBillingAccountSummary({
      canManageBilling: await canManageOrganizationBilling(
        billingAuthorizationContext(c),
      ),
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(getUsageRoute, async (c) => {
    setPrivateNoStore(c)
    return c.json(await getBillingUsageSummary({
      month: c.req.valid('query').month,
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(getUsageMonthsRoute, async (c) => {
    setPrivateNoStore(c)
    return c.json(await listBillingUsageMonths({
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(getUsageRunsRoute, async (c) => {
    setPrivateNoStore(c)
    const query = c.req.valid('query')
    return c.json(await listBillingUsageRuns({
      cursor: query.cursor,
      limit: query.limit,
      month: query.month,
      organizationId: c.var.organizationId,
      requestingUserId: c.var.userId,
    }), 200)
  })

  app.openapi(getLedgerRoute, async (c) => {
    setPrivateNoStore(c)
    await requireOrganizationBillingAdministrator(
      billingAuthorizationContext(c),
    )
    const query = c.req.valid('query')
    return c.json(await listBillingLedger({
      cursor: query.cursor,
      limit: query.limit,
      month: query.month,
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(createCheckoutRoute, async (c) => {
    await requireOrganizationBillingAdministrator(
      billingAuthorizationContext(c),
    )
    return c.json(await createSubscriptionCheckout({
      ...c.req.valid('json'),
      idempotencyKey: requireIdempotencyKey(
        c.req.header('Idempotency-Key'),
      ),
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(previewSubscriptionChangeRoute, async (c) => {
    await requireOrganizationBillingAdministrator(
      billingAuthorizationContext(c),
    )
    const preview = await previewSubscriptionChange({
      ...c.req.valid('json'),
      organizationId: c.var.organizationId,
    })
    setPrivateNoStore(c)
    return c.json({
      ...preview,
      effectiveAt: preview.effectiveAt.toISOString(),
      nextRenewalAt: preview.nextRenewalAt?.toISOString() ?? null,
      prorationDate: preview.prorationDate?.toISOString() ?? null,
    }, 200)
  })

  app.openapi(updateSubscriptionRoute, async (c) => {
    await requireOrganizationBillingAdministrator(
      billingAuthorizationContext(c),
    )
    const request = c.req.valid('json')
    const result = await updatePaidSubscription({
      ...request,
      idempotencyKey: requireIdempotencyKey(
        c.req.header('Idempotency-Key'),
      ),
      organizationId: c.var.organizationId,
      prorationDate: request.prorationDate
        ? new Date(request.prorationDate)
        : undefined,
    })
    setPrivateNoStore(c)
    return c.json({
      ...result,
      account: await getBillingAccountSummary({
        canManageBilling: true,
        organizationId: c.var.organizationId,
      }),
    }, 200)
  })

  app.openapi(cancelSubscriptionScheduleRoute, async (c) => {
    await requireOrganizationBillingAdministrator(
      billingAuthorizationContext(c),
    )
    const result = await cancelScheduledSubscriptionChange(
      c.var.organizationId,
    )
    setPrivateNoStore(c)
    return c.json({
      ...result,
      account: await getBillingAccountSummary({
        canManageBilling: true,
        organizationId: c.var.organizationId,
      }),
    }, 200)
  })

  app.openapi(createTopUpCheckoutRoute, async (c) => {
    await requireOrganizationBillingAdministrator(
      billingAuthorizationContext(c),
    )
    return c.json(await createTopUpCheckout({
      ...c.req.valid('json'),
      idempotencyKey: requireIdempotencyKey(
        c.req.header('Idempotency-Key'),
      ),
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(createPortalRoute, async (c) => {
    await requireOrganizationBillingAdministrator(
      billingAuthorizationContext(c),
    )
    return c.json(await createCustomerPortalSession(
      c.var.organizationId,
    ), 200)
  })

  app.openapi(assignFounderRoute, async (c) => {
    requireSystemBillingAdministrator({ isSystemAdmin: c.var.isSystemAdmin })
    requireIdempotencyKey(c.req.header('Idempotency-Key'))
    await enrollOrganizationFounder({
      assignedBy: c.var.userId,
      organizationId: c.var.organizationId,
    })
    setPrivateNoStore(c)
    return c.json(await getBillingAccountSummary({
      canManageBilling: true,
      organizationId: c.var.organizationId,
    }), 200)
  })
}
