/** Hono/OpenAPI route bindings for the shared durable run lifecycle. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute, z } from '@hono/zod-openapi'

import { assertFlowRunExecutionModeAuthorized } from '../../domain/runs/execution-mode.js'
import {
  admitDirectGeneration,
  admitFlowRun,
  cancelRun,
  createRunRealtimeToken,
  estimateDirectGeneration,
  getRunDetail,
  listActiveRuns,
  listRunHistory,
  reconcileRuns,
  retryRun,
} from '../../services/runs.service.js'
import { commonErrorResponses } from '../product.responses.js'
import { registerBrowserRunRoutes } from './browser-runs.routes.js'
import {
  ActiveRunListQuerySchema,
  ActiveRunListResponseSchema,
  CreateDirectRunRequestSchema,
  CreateFlowRunRequestSchema,
  CreateRunRequestSchema,
  DirectRunEstimateResponseSchema,
  EstimateDirectRunRequestSchema,
  FlowRunParamsSchema,
  FlowRunSchema,
  RetryRunRequestSchema,
  RunListQuerySchema,
  RunListResponseSchema,
  RunParamsSchema,
  RunRealtimeTokenSchema,
} from './runs.schemas.js'

const listRunsRoute = createRoute({
  method: 'get',
  path: '/runs',
  tags: ['Runs'],
  request: { query: RunListQuerySchema },
  responses: {
    200: {
      description: 'Run list',
      content: { 'application/json': { schema: RunListResponseSchema } },
    },
    ...commonErrorResponses,
  },
})

const listActiveRunsRoute = createRoute({
  method: 'get',
  path: '/runs/active',
  tags: ['Runs'],
  request: { query: ActiveRunListQuerySchema },
  responses: {
    200: {
      description: 'Active run identities',
      content: { 'application/json': { schema: ActiveRunListResponseSchema } },
    },
    ...commonErrorResponses,
  },
})

const createRunRoute = createRoute({
  method: 'post',
  path: '/runs',
  tags: ['Runs'],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateRunRequestSchema } },
    },
  },
  responses: {
    202: {
      description: 'Run admitted',
      content: { 'application/json': { schema: FlowRunSchema } },
    },
    ...commonErrorResponses,
  },
})

const estimateDirectRunRoute = createRoute({
  method: 'post',
  path: '/runs/create/estimate',
  tags: ['Runs'],
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: EstimateDirectRunRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Direct run cost estimate',
      content: {
        'application/json': { schema: DirectRunEstimateResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const createDirectRunRoute = createRoute({
  method: 'post',
  path: '/runs/create',
  tags: ['Runs'],
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CreateDirectRunRequestSchema } },
    },
  },
  responses: {
    202: {
      description: 'Direct run admitted',
      content: { 'application/json': { schema: FlowRunSchema } },
    },
    ...commonErrorResponses,
  },
})

const createFlowRunRoute = createRoute({
  method: 'post',
  path: '/flows/{flowId}/runs',
  tags: ['Runs'],
  request: {
    params: FlowRunParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: CreateFlowRunRequestSchema } },
    },
  },
  responses: {
    202: {
      description: 'Run admitted',
      content: { 'application/json': { schema: FlowRunSchema } },
    },
    ...commonErrorResponses,
  },
})

const getRunRoute = createRoute({
  method: 'get',
  path: '/runs/{id}',
  tags: ['Runs'],
  request: { params: RunParamsSchema },
  responses: {
    200: {
      description: 'Run detail',
      content: { 'application/json': { schema: FlowRunSchema } },
    },
    ...commonErrorResponses,
  },
})

const cancelRunRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/cancel',
  tags: ['Runs'],
  request: { params: RunParamsSchema },
  responses: {
    202: {
      description: 'Run cancellation requested',
      content: { 'application/json': { schema: FlowRunSchema } },
    },
    ...commonErrorResponses,
  },
})

const retryRunRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/retry',
  tags: ['Runs'],
  request: {
    params: RunParamsSchema,
    body: {
      required: false,
      content: { 'application/json': { schema: RetryRunRequestSchema } },
    },
  },
  responses: {
    202: {
      description: 'Run retry admitted',
      content: { 'application/json': { schema: FlowRunSchema } },
    },
    ...commonErrorResponses,
  },
})

const createRunRealtimeTokenRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/realtime-token',
  tags: ['Runs'],
  request: { params: RunParamsSchema },
  responses: {
    200: {
      description: 'Run-scoped Trigger.dev realtime token',
      content: { 'application/json': { schema: RunRealtimeTokenSchema } },
    },
    ...commonErrorResponses,
  },
})

const reconcileRunsRoute = createRoute({
  method: 'post',
  path: '/runs/reconcile',
  tags: ['Runs'],
  responses: {
    200: {
      description: 'Run dispatch reconciliation result',
      content: {
        'application/json': {
          schema: z.object({ dispatched: z.number().int().nonnegative() }),
        },
      },
    },
    ...commonErrorResponses,
  },
})

/** Registers tenant-scoped Flow and direct Create run endpoints. */
export function registerRunRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRunsRoute, async (c) => {
    const query = c.req.valid('query')
    return c.json(
      await listRunHistory({
        createSessionId: query.createSessionId,
        createdBy: c.var.userId,
        cursor: query.cursor,
        flowId: query.flowId,
        limit: query.limit,
        organizationId: c.var.organizationId,
        source: query.source,
      }),
      200,
    )
  })

  app.openapi(listActiveRunsRoute, async (c) => {
    const query = c.req.valid('query')
    return c.json(
      await listActiveRuns({
        executionRuntime: query.executionRuntime,
        organizationId: c.var.organizationId,
        requestingUserId: c.var.userId,
        scope: query.scope,
        source: query.source,
      }),
      200,
    )
  })

  app.openapi(estimateDirectRunRoute, async (c) => {
    const body = c.req.valid('json')
    assertFlowRunExecutionModeAuthorized(
      body.executionMode,
      c.var.isSystemAdmin,
    )
    return c.json(
      await estimateDirectGeneration({
        body,
        organizationId: c.var.organizationId,
        signal: c.req.raw.signal,
      }),
      200,
    )
  })

  app.openapi(createDirectRunRoute, async (c) => {
    const body = c.req.valid('json')
    assertFlowRunExecutionModeAuthorized(
      body.executionMode,
      c.var.isSystemAdmin,
    )
    return c.json(
      await admitDirectGeneration({
        body,
        idempotencyKey: c.req.header('Idempotency-Key') ?? null,
        organizationId: c.var.organizationId,
        userId: c.var.userId,
      }),
      202,
    )
  })

  app.openapi(createRunRoute, async (c) => {
    const body = c.req.valid('json')
    assertFlowRunExecutionModeAuthorized(
      body.executionMode,
      c.var.isSystemAdmin,
    )
    return c.json(
      await admitFlowRun({
        body,
        idempotencyKey: c.req.header('Idempotency-Key') ?? null,
        organizationId: c.var.organizationId,
        userId: c.var.userId,
      }),
      202,
    )
  })

  app.openapi(createFlowRunRoute, async (c) => {
    const body = c.req.valid('json')
    assertFlowRunExecutionModeAuthorized(
      body.executionMode,
      c.var.isSystemAdmin,
    )
    return c.json(
      await admitFlowRun({
        body: {
          ...body,
          flowId: c.req.valid('param').flowId,
        },
        idempotencyKey: c.req.header('Idempotency-Key') ?? null,
        organizationId: c.var.organizationId,
        userId: c.var.userId,
      }),
      202,
    )
  })

  app.openapi(getRunRoute, async (c) => {
    return c.json(
      await getRunDetail(
        c.var.organizationId,
        c.req.valid('param').id,
        c.var.userId,
      ),
      200,
    )
  })

  app.openapi(cancelRunRoute, async (c) => {
    return c.json(
      await cancelRun({
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      202,
    )
  })

  app.openapi(retryRunRoute, async (c) => {
    const body = c.req.valid('json')
    if (body?.executionMode) {
      assertFlowRunExecutionModeAuthorized(
        body.executionMode,
        c.var.isSystemAdmin,
      )
    }
    return c.json(
      await retryRun({
        executionMode: body?.executionMode,
        executionRuntime: body?.executionRuntime,
        expectedRunStatus: body?.expectedRunStatus,
        idempotencyKey: c.req.header('Idempotency-Key') ?? null,
        isSystemAdmin: c.var.isSystemAdmin,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      202,
    )
  })

  app.openapi(createRunRealtimeTokenRoute, async (c) => {
    return c.json(
      await createRunRealtimeToken({
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    )
  })

  app.openapi(reconcileRunsRoute, async (c) => {
    return c.json(await reconcileRuns(c.var.organizationId), 200)
  })
  registerBrowserRunRoutes(app)
}
