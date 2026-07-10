import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'

import { createRoute } from '@hono/zod-openapi'
import { apiError } from '../../middleware/error.js'
import { requireOrganization } from '../../middleware/organization.js'
import {
  createProject,
  editProject,
  getProject,
  listProjects,
  removeProject,
} from '../../services/projects.service.js'
import { invalidCursorError } from '../shared/errors.js'
import {
  notFoundErrorResponse,
  organizationErrorResponses,
  validationErrorResponse,
} from '../shared/responses.js'
import {
  CreateProjectRequestSchema,
  ListProjectsQuerySchema,
  ListProjectsResponseSchema,
  ProjectIdParamsSchema,
  ProjectSchema,
  UpdateProjectRequestSchema,
} from './projects.schemas.js'

const notFound = notFoundErrorResponse('Project')

const listRoute = createRoute({
  method: 'get',
  path: '/projects',
  operationId: 'listProjects',
  tags: ['Projects'],
  request: { query: ListProjectsQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ListProjectsResponseSchema } },
      description: 'Projects in the active organization',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
  },
})

const createProjectRoute = createRoute({
  method: 'post',
  path: '/projects',
  operationId: 'createProject',
  tags: ['Projects'],
  request: {
    body: {
      content: { 'application/json': { schema: CreateProjectRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Created project',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
  },
})

const getProjectRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}',
  operationId: 'getProject',
  tags: ['Projects'],
  request: { params: ProjectIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project detail',
    },
    ...organizationErrorResponses,
    404: notFound,
  },
})

const updateProjectRoute = createRoute({
  method: 'patch',
  path: '/projects/{projectId}',
  operationId: 'updateProject',
  tags: ['Projects'],
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateProjectRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Updated project',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
    404: notFound,
  },
})

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}',
  operationId: 'deleteProject',
  tags: ['Projects'],
  request: { params: ProjectIdParamsSchema },
  responses: {
    204: { description: 'Deleted project' },
    ...organizationErrorResponses,
    404: notFound,
  },
})

export function registerProjectRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const query = c.req.valid('query')
    const result = await listProjects({ organizationId, ...query })

    if (!result.ok) {
      return c.json(invalidCursorError, 400)
    }

    return c.json({ data: result.data, nextCursor: result.nextCursor }, 200)
  })

  app.openapi(createProjectRoute, async (c) => {
    const context = requireOrganization(c)
    const project = await createProject({
      ...context,
      ...c.req.valid('json'),
      createdBy: context.userId,
    })

    return c.json(project, 201)
  })

  app.openapi(getProjectRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const { projectId } = c.req.valid('param')
    const project = await getProject(organizationId, projectId)

    if (!project)
      return c.json(apiError('not_found', 'Project not found.'), 404)

    return c.json(project, 200)
  })

  app.openapi(updateProjectRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const { projectId } = c.req.valid('param')
    const project = await editProject({
      ...c.req.valid('json'),
      organizationId,
      projectId,
    })

    if (!project)
      return c.json(apiError('not_found', 'Project not found.'), 404)

    return c.json(project, 200)
  })

  app.openapi(deleteProjectRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const { projectId } = c.req.valid('param')
    const deleted = await removeProject(organizationId, projectId)

    if (!deleted)
      return c.json(apiError('not_found', 'Project not found.'), 404)

    return c.body(null, 204)
  })
}
