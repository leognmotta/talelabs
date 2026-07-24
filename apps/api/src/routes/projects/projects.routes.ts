/** Hono/OpenAPI routes for Project CRUD, archive, and restore. */

import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { bodyLimit } from 'hono/body-limit'

import { apiError } from '../../middleware/error.js'
import {
  getProjectBrief,
  resolveProjectBriefMentions,
  saveProjectBrief,
  searchProjectBriefMentions,
} from '../../services/project-briefs.service.js'
import { getProjectHome } from '../../services/project-home.service.js'
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  restoreProject,
  updateProject,
} from '../../services/projects.service.js'
import { commonErrorResponses } from '../product.responses.js'
import {
  ProjectBriefSchema,
  ProjectMentionSearchQuerySchema,
  ProjectMentionSearchResponseSchema,
  ResolveProjectMentionsRequestSchema,
  ResolveProjectMentionsResponseSchema,
  SaveProjectBriefRequestSchema,
} from './project-briefs.schemas.js'
import { ProjectHomeSchema } from './project-home.schemas.js'
import {
  CreateProjectRequestSchema,
  ProjectListQuerySchema,
  ProjectListResponseSchema,
  ProjectParamsSchema,
  ProjectSchema,
  UpdateProjectRequestSchema,
} from './projects.schemas.js'

const listRoute = createRoute({
  method: 'get',
  path: '/projects',
  tags: ['Projects'],
  request: { query: ProjectListQuerySchema },
  responses: {
    200: {
      description: 'Project list page',
      content: { 'application/json': { schema: ProjectListResponseSchema } },
    },
    ...commonErrorResponses,
  },
})

const createRouteDefinition = createRoute({
  method: 'post',
  path: '/projects',
  tags: ['Projects'],
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: CreateProjectRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: 'Project created',
      content: { 'application/json': { schema: ProjectSchema } },
    },
    ...commonErrorResponses,
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}',
  tags: ['Projects'],
  request: { params: ProjectParamsSchema },
  responses: {
    200: {
      description: 'Project detail',
      content: { 'application/json': { schema: ProjectSchema } },
    },
    ...commonErrorResponses,
  },
})

const getHomeRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/home',
  tags: ['Projects'],
  request: { params: ProjectParamsSchema },
  responses: {
    200: {
      description: 'Compact bounded Project Home',
      content: { 'application/json': { schema: ProjectHomeSchema } },
    },
    ...commonErrorResponses,
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/projects/{projectId}',
  tags: ['Projects'],
  request: {
    params: ProjectParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: UpdateProjectRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Project updated',
      content: { 'application/json': { schema: ProjectSchema } },
    },
    ...commonErrorResponses,
  },
})

function lifecycleRoute(action: 'archive' | 'restore') {
  return createRoute({
    method: 'post',
    path: `/projects/{projectId}/${action}`,
    tags: ['Projects'],
    request: { params: ProjectParamsSchema },
    responses: {
      200: {
        description: `Project ${action}d`,
        content: { 'application/json': { schema: ProjectSchema } },
      },
      ...commonErrorResponses,
    },
  })
}

const archiveRoute = lifecycleRoute('archive')
const restoreRoute = lifecycleRoute('restore')

const getBriefRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/brief',
  tags: ['Project Briefs'],
  request: { params: ProjectParamsSchema },
  responses: {
    200: {
      description: 'Project Brief with batched mention metadata',
      content: { 'application/json': { schema: ProjectBriefSchema } },
    },
    ...commonErrorResponses,
  },
})

const saveBriefRoute = createRoute({
  method: 'patch',
  path: '/projects/{projectId}/brief',
  tags: ['Project Briefs'],
  request: {
    params: ProjectParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: SaveProjectBriefRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Revision-safe Project Brief save',
      content: { 'application/json': { schema: ProjectBriefSchema } },
    },
    ...commonErrorResponses,
  },
})

const searchMentionsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/brief/mentions',
  tags: ['Project Briefs'],
  request: {
    params: ProjectParamsSchema,
    query: ProjectMentionSearchQuerySchema,
  },
  responses: {
    200: {
      description: 'Grouped Project entity suggestions',
      content: {
        'application/json': { schema: ProjectMentionSearchResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

const resolveMentionsRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/brief/mentions/resolve',
  tags: ['Project Briefs'],
  request: {
    params: ProjectParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': { schema: ResolveProjectMentionsRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Batch-resolved Project mentions',
      content: {
        'application/json': { schema: ResolveProjectMentionsResponseSchema },
      },
    },
    ...commonErrorResponses,
  },
})

/** Registers Project CRUD and lifecycle routes. */
export function registerProjectRoutes(app: OpenAPIHono<ApiEnv>) {
  app.use('/projects/:projectId/brief', bodyLimit({
    maxSize: 300 * 1024,
    onError: c => c.json(apiError(
      'validation_error',
      'The Project Brief request is too large.',
      [{
        code: 'request_body_limit',
        field: 'document',
        message: 'The Project Brief exceeds the maximum request size.',
        params: { maximum: 300 * 1024 },
      }],
    ), 400),
  }))
  app.openapi(listRoute, async (c) => {
    return c.json(await listProjects({
      ...c.req.valid('query'),
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(createRouteDefinition, async (c) => {
    return c.json(await createProject({
      ...c.req.valid('json'),
      createdBy: c.var.userId,
      organizationId: c.var.organizationId,
    }), 201)
  })
  app.openapi(getRoute, async (c) => {
    return c.json(await getProject({
      id: c.req.valid('param').projectId,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(getHomeRoute, async (c) => {
    return c.json(await getProjectHome({
      organizationId: c.var.organizationId,
      projectId: c.req.valid('param').projectId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(updateRoute, async (c) => {
    return c.json(await updateProject({
      ...c.req.valid('json'),
      id: c.req.valid('param').projectId,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(archiveRoute, async (c) => {
    return c.json(await archiveProject({
      id: c.req.valid('param').projectId,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(restoreRoute, async (c) => {
    return c.json(await restoreProject({
      id: c.req.valid('param').projectId,
      organizationId: c.var.organizationId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(getBriefRoute, async (c) => {
    return c.json(await getProjectBrief({
      organizationId: c.var.organizationId,
      projectId: c.req.valid('param').projectId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(saveBriefRoute, async (c) => {
    return c.json(await saveProjectBrief({
      ...c.req.valid('json'),
      organizationId: c.var.organizationId,
      projectId: c.req.valid('param').projectId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(searchMentionsRoute, async (c) => {
    return c.json(await searchProjectBriefMentions({
      ...c.req.valid('query'),
      organizationId: c.var.organizationId,
      projectId: c.req.valid('param').projectId,
      userId: c.var.userId,
    }), 200)
  })
  app.openapi(resolveMentionsRoute, async (c) => {
    return c.json(await resolveProjectBriefMentions({
      ...c.req.valid('json'),
      organizationId: c.var.organizationId,
      projectId: c.req.valid('param').projectId,
      userId: c.var.userId,
    }), 200)
  })
}
