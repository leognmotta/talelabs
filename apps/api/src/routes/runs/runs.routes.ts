import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute, z } from '@hono/zod-openapi'

import {
  admitFlowRun,
  cancelRun,
  createRunRealtimeToken,
  getRunDetail,
  listRuns,
  reconcileRuns,
  retryRun,
} from '../../services/runs.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateFlowRunRequestSchema,
  CreateRunRequestSchema,
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
    200: { description: 'Run list', content: { 'application/json': { schema: RunListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const createRunRoute = createRoute({
  method: 'post',
  path: '/runs',
  tags: ['Runs'],
  request: {
    body: { required: true, content: { 'application/json': { schema: CreateRunRequestSchema } } },
  },
  responses: {
    202: { description: 'Run admitted', content: { 'application/json': { schema: FlowRunSchema } } },
    ...commonErrorResponses,
  },
})

const createFlowRunRoute = createRoute({
  method: 'post',
  path: '/flows/{flowId}/runs',
  tags: ['Runs'],
  request: {
    params: FlowRunParamsSchema,
    body: { required: true, content: { 'application/json': { schema: CreateFlowRunRequestSchema } } },
  },
  responses: {
    202: { description: 'Run admitted', content: { 'application/json': { schema: FlowRunSchema } } },
    ...commonErrorResponses,
  },
})

const getRunRoute = createRoute({
  method: 'get',
  path: '/runs/{id}',
  tags: ['Runs'],
  request: { params: RunParamsSchema },
  responses: {
    200: { description: 'Run detail', content: { 'application/json': { schema: FlowRunSchema } } },
    ...commonErrorResponses,
  },
})

const cancelRunRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/cancel',
  tags: ['Runs'],
  request: { params: RunParamsSchema },
  responses: {
    202: { description: 'Run cancellation requested', content: { 'application/json': { schema: FlowRunSchema } } },
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
    202: { description: 'Run retry admitted', content: { 'application/json': { schema: FlowRunSchema } } },
    ...commonErrorResponses,
  },
})

const createRunRealtimeTokenRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/realtime-token',
  tags: ['Runs'],
  request: { params: RunParamsSchema },
  responses: {
    200: { description: 'Run-scoped Trigger.dev realtime token', content: { 'application/json': { schema: RunRealtimeTokenSchema } } },
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
      content: { 'application/json': { schema: z.object({ dispatched: z.number().int().nonnegative() }) } },
    },
    ...commonErrorResponses,
  },
})

export function registerRunRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRunsRoute, async (c) => {
    return c.json(await listRuns({
      ...c.req.valid('query'),
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(createRunRoute, async (c) => {
    return c.json(await admitFlowRun({
      body: c.req.valid('json'),
      idempotencyKey: c.req.header('Idempotency-Key') ?? null,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 202)
  })

  app.openapi(createFlowRunRoute, async (c) => {
    return c.json(await admitFlowRun({
      body: {
        ...c.req.valid('json'),
        flowId: c.req.valid('param').flowId,
      },
      idempotencyKey: c.req.header('Idempotency-Key') ?? null,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 202)
  })

  app.openapi(getRunRoute, async (c) => {
    return c.json(await getRunDetail(
      c.var.organizationId,
      c.req.valid('param').id,
    ), 200)
  })

  app.openapi(cancelRunRoute, async (c) => {
    return c.json(await cancelRun({
      organizationId: c.var.organizationId,
      runId: c.req.valid('param').id,
    }), 202)
  })

  app.openapi(retryRunRoute, async (c) => {
    return c.json(await retryRun({
      expectedRunStatus: c.req.valid('json')?.expectedRunStatus,
      idempotencyKey: c.req.header('Idempotency-Key') ?? null,
      organizationId: c.var.organizationId,
      runId: c.req.valid('param').id,
      userId: c.var.userId,
    }), 202)
  })

  app.openapi(createRunRealtimeTokenRoute, async (c) => {
    return c.json(await createRunRealtimeToken({
      organizationId: c.var.organizationId,
      runId: c.req.valid('param').id,
    }), 200)
  })

  app.openapi(reconcileRunsRoute, async (c) => {
    return c.json(await reconcileRuns(c.var.organizationId), 200)
  })
}
