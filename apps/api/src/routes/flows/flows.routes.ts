import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { FLOW_GRAPH_LIMITS } from '@talelabs/flows'
import { bodyLimit } from 'hono/body-limit'

import { apiError } from '../../middleware/error.js'
import {
  createFlow,
  deleteFlow,
  getFlow,
  getFlowGraph,
  getFlowReferences,
  listFlows,
  syncFlowGraph,
  updateFlow,
} from '../../services/flows.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  CreateFlowRequestSchema,
  FlowGraphReferencesSchema,
  FlowGraphResponseSchema,
  FlowGraphSyncRequestSchema,
  FlowGraphSyncResponseSchema,
  FlowListQuerySchema,
  FlowListResponseSchema,
  FlowParamsSchema,
  FlowSchema,
  UpdateFlowRequestSchema,
} from './flows.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/flows',
  tags: ['Flows'],
  request: { query: FlowListQuerySchema },
  responses: {
    200: { description: 'Flow list page', content: { 'application/json': { schema: FlowListResponseSchema } } },
    ...commonErrorResponses,
  },
})

const createFlowRoute = createRoute({
  method: 'post',
  path: '/flows',
  tags: ['Flows'],
  request: { body: { required: true, content: { 'application/json': { schema: CreateFlowRequestSchema } } } },
  responses: {
    201: { description: 'Flow created', content: { 'application/json': { schema: FlowSchema } } },
    ...commonErrorResponses,
  },
})

const getFlowRoute = createRoute({
  method: 'get',
  path: '/flows/{id}',
  tags: ['Flows'],
  request: { params: FlowParamsSchema },
  responses: {
    200: { description: 'Flow detail', content: { 'application/json': { schema: FlowSchema } } },
    ...commonErrorResponses,
  },
})

const updateFlowRoute = createRoute({
  method: 'patch',
  path: '/flows/{id}',
  tags: ['Flows'],
  request: {
    params: FlowParamsSchema,
    body: { required: true, content: { 'application/json': { schema: UpdateFlowRequestSchema } } },
  },
  responses: {
    200: { description: 'Flow updated', content: { 'application/json': { schema: FlowSchema } } },
    ...commonErrorResponses,
  },
})

const deleteFlowRoute = createRoute({
  method: 'delete',
  path: '/flows/{id}',
  tags: ['Flows'],
  request: { params: FlowParamsSchema },
  responses: {
    204: { description: 'Flow deleted' },
    ...commonErrorResponses,
  },
})

const getGraphRoute = createRoute({
  method: 'get',
  path: '/flows/{id}/graph',
  tags: ['Flows'],
  request: { params: FlowParamsSchema },
  responses: {
    200: { description: 'Flow graph', content: { 'application/json': { schema: FlowGraphResponseSchema } } },
    ...commonErrorResponses,
  },
})

const getReferencesRoute = createRoute({
  method: 'get',
  path: '/flows/{id}/references',
  tags: ['Flows'],
  request: { params: FlowParamsSchema },
  responses: {
    200: { description: 'Flow graph references', content: { 'application/json': { schema: FlowGraphReferencesSchema } } },
    ...commonErrorResponses,
  },
})

const syncGraphRoute = createRoute({
  method: 'post',
  path: '/flows/{id}/graph',
  tags: ['Flows'],
  request: {
    params: FlowParamsSchema,
    body: { required: true, content: { 'application/json': { schema: FlowGraphSyncRequestSchema } } },
  },
  responses: {
    200: { description: 'Flow graph saved', content: { 'application/json': { schema: FlowGraphSyncResponseSchema } } },
    ...commonErrorResponses,
  },
})

export function registerFlowRoutes(app: OpenAPIHono<ApiEnv>) {
  app.use('/flows/:id/graph', bodyLimit({
    maxSize: FLOW_GRAPH_LIMITS.requestBodyBytes,
    onError: c => c.json(apiError(
      'validation_error',
      'The Flow graph request is too large.',
      [{
        code: 'request_body_limit',
        field: '',
        message: 'The Flow graph request exceeds the maximum size.',
        params: { maximum: FLOW_GRAPH_LIMITS.requestBodyBytes },
      }],
    ), 400),
  }))

  app.openapi(listRoute, async (c) => {
    return c.json(await listFlows({
      ...c.req.valid('query'),
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(createFlowRoute, async (c) => {
    return c.json(await createFlow({
      ...c.req.valid('json'),
      createdBy: c.var.userId,
      organizationId: c.var.organizationId,
    }), 201)
  })

  app.openapi(getFlowRoute, async (c) => {
    return c.json(await getFlow(
      c.var.organizationId,
      c.req.valid('param').id,
    ), 200)
  })

  app.openapi(updateFlowRoute, async (c) => {
    return c.json(await updateFlow({
      ...c.req.valid('json'),
      id: c.req.valid('param').id,
      organizationId: c.var.organizationId,
    }), 200)
  })

  app.openapi(deleteFlowRoute, async (c) => {
    await deleteFlow(c.var.organizationId, c.req.valid('param').id)
    return c.body(null, 204)
  })

  app.openapi(getGraphRoute, async (c) => {
    return c.json(await getFlowGraph(
      c.var.organizationId,
      c.req.valid('param').id,
    ), 200)
  })

  app.openapi(getReferencesRoute, async (c) => {
    return c.json(await getFlowReferences(
      c.var.organizationId,
      c.req.valid('param').id,
    ), 200)
  })

  app.openapi(syncGraphRoute, async (c) => {
    return c.json(await syncFlowGraph({
      ...c.req.valid('json'),
      flowId: c.req.valid('param').id,
      organizationId: c.var.organizationId,
    }), 200)
  })
}
