/** Explicit OpenAPI routes for the fenced browser execution driver. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute, z } from '@hono/zod-openapi'

import {
  acknowledgeBrowserJobCancellation,
  acquireBrowserRunLease,
  beginBrowserJobSubmission,
  checkpointBrowserJob,
  claimBrowserRunJobs,
  completeBrowserJob,
  createBrowserOutputGrant,
  failBrowserJob,
  finalizeBrowserMediaOutput,
  finalizeBrowserTextOutput,
  getBrowserRunManifest,
  releaseBrowserRunLease,
  updateBrowserExecutorStatus,
} from '../../services/runs.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  BrowserBeginSubmissionRequestSchema,
  BrowserBeginSubmissionResponseSchema,
  BrowserCancellationRequestSchema,
  BrowserCancellationResponseSchema,
  BrowserCompleteJobRequestSchema,
  BrowserCompleteJobResponseSchema,
  BrowserExecutorSchema,
  BrowserExecutorStatusRequestSchema,
  BrowserExecutorStatusResponseSchema,
  BrowserFailJobRequestSchema,
  BrowserFailJobResponseSchema,
  BrowserFinalizeMediaRequestSchema,
  BrowserFinalizeOutputResponseSchema,
  BrowserFinalizeTextRequestSchema,
  BrowserJobCheckpointRequestSchema,
  BrowserJobCheckpointResponseSchema,
  BrowserLeaseActorSchema,
  BrowserLeaseQuerySchema,
  BrowserOutputGrantRequestSchema,
  BrowserOutputGrantSchema,
  BrowserRunClaimRequestSchema,
  BrowserRunClaimResponseSchema,
  BrowserRunJobParamsSchema,
  BrowserRunLeaseSchema,
  BrowserRunManifestResponseSchema,
} from './browser-run.schemas.js'
import { RunParamsSchema } from './runs.schemas.js'

const acquireBrowserLeaseRoute = createRoute({
  method: 'put',
  path: '/runs/{id}/browser-lease',
  tags: ['Runs'],
  request: {
    params: RunParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: BrowserExecutorSchema } },
    },
  },
  responses: {
    200: {
      description: 'Browser lease acquired or renewed',
      content: { 'application/json': { schema: BrowserRunLeaseSchema } },
    },
    ...commonErrorResponses,
  },
})

const releaseBrowserLeaseRoute = createRoute({
  method: 'delete',
  path: '/runs/{id}/browser-lease',
  tags: ['Runs'],
  request: {
    params: RunParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: BrowserLeaseActorSchema } },
    },
  },
  responses: {
    200: {
      description: 'Browser lease released',
      content: {
        'application/json': { schema: z.object({ released: z.boolean() }) },
      },
    },
    ...commonErrorResponses,
  },
})

const getBrowserManifestRoute = createRoute({
  method: 'get',
  path: '/runs/{id}/browser-manifest',
  tags: ['Runs'],
  request: { params: RunParamsSchema, query: BrowserLeaseQuerySchema },
  responses: {
    200: {
      description: 'Authoritative browser recovery manifest',
      content: {
        'application/json': { schema: BrowserRunManifestResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const claimBrowserJobsRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/claim',
  tags: ['Runs'],
  request: {
    params: RunParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: BrowserRunClaimRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Dependency-ready browser jobs',
      content: {
        'application/json': { schema: BrowserRunClaimResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const beginBrowserSubmissionRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/begin-submission',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserBeginSubmissionRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'One-shot browser provider submission opened',
      content: {
        'application/json': { schema: BrowserBeginSubmissionResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const checkpointBrowserJobRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/checkpoint',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserJobCheckpointRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Browser provider identity checkpointed',
      content: {
        'application/json': { schema: BrowserJobCheckpointResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const createBrowserOutputGrantRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/output-grant',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserOutputGrantRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Short-lived exact output upload grant',
      content: { 'application/json': { schema: BrowserOutputGrantSchema } },
    },
    ...commonErrorResponses,
  },
})

const finalizeBrowserMediaRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/finalize-media',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserFinalizeMediaRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Canonical browser media persisted and ingestion dispatched',
      content: {
        'application/json': { schema: BrowserFinalizeOutputResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const finalizeBrowserTextRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/finalize-text',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserFinalizeTextRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Canonical browser text finalized',
      content: {
        'application/json': { schema: BrowserFinalizeOutputResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const completeBrowserJobRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/complete',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserCompleteJobRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Browser job completed or awaiting Asset readiness',
      content: {
        'application/json': { schema: BrowserCompleteJobResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const failBrowserJobRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/fail',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: BrowserFailJobRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Browser job failure recorded',
      content: { 'application/json': { schema: BrowserFailJobResponseSchema } },
    },
    ...commonErrorResponses,
  },
})

const acknowledgeBrowserCancellationRoute = createRoute({
  method: 'post',
  path: '/runs/{id}/browser-jobs/{jobId}/cancel-ack',
  tags: ['Runs'],
  request: {
    params: BrowserRunJobParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserCancellationRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Browser provider cancellation reconciled',
      content: {
        'application/json': { schema: BrowserCancellationResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const updateBrowserExecutorStatusRoute = createRoute({
  method: 'put',
  path: '/runs/{id}/browser-executor-status',
  tags: ['Runs'],
  request: {
    params: RunParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: BrowserExecutorStatusRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Safe browser executor state persisted',
      content: {
        'application/json': { schema: BrowserExecutorStatusResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

/** Registers typed endpoints owned only by the browser execution driver. */
export function registerBrowserRunRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(acquireBrowserLeaseRoute, async c =>
    c.json(
      await acquireBrowserRunLease({
        ...c.req.valid('json'),
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(releaseBrowserLeaseRoute, async c =>
    c.json(
      await releaseBrowserRunLease({
        ...c.req.valid('json'),
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(getBrowserManifestRoute, async c =>
    c.json(
      await getBrowserRunManifest({
        ...c.req.valid('query'),
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(claimBrowserJobsRoute, async c =>
    c.json(
      await claimBrowserRunJobs({
        ...c.req.valid('json'),
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(beginBrowserSubmissionRoute, async c =>
    c.json(
      await beginBrowserJobSubmission({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(checkpointBrowserJobRoute, async c =>
    c.json(
      await checkpointBrowserJob({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(createBrowserOutputGrantRoute, async c =>
    c.json(
      await createBrowserOutputGrant({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(finalizeBrowserMediaRoute, async c =>
    c.json(
      await finalizeBrowserMediaOutput({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(finalizeBrowserTextRoute, async c =>
    c.json(
      await finalizeBrowserTextOutput({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(completeBrowserJobRoute, async c =>
    c.json(
      await completeBrowserJob({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(failBrowserJobRoute, async c =>
    c.json(
      await failBrowserJob({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(acknowledgeBrowserCancellationRoute, async c =>
    c.json(
      await acknowledgeBrowserJobCancellation({
        ...c.req.valid('json'),
        jobId: c.req.valid('param').jobId,
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
  app.openapi(updateBrowserExecutorStatusRoute, async c =>
    c.json(
      await updateBrowserExecutorStatus({
        ...c.req.valid('json'),
        organizationId: c.var.organizationId,
        runId: c.req.valid('param').id,
        userId: c.var.userId,
      }),
      200,
    ))
}
