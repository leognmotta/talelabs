import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiEnv } from '../../types.js'
import { createRoute } from '@hono/zod-openapi'
import { apiError } from '../../middleware/error.js'
import { requireOrganization } from '../../middleware/organization.js'
import {
  addCharacterToBrand,
  createCharacter,
  editCharacter,
  getCharacter,
  listBrandCharacters,
  listCharacters,
  removeCharacter,
  removeCharacterFromBrand,
} from '../../services/characters.service.js'
import { invalidCursorError } from '../shared/errors.js'
import {
  notFoundErrorResponse,
  organizationErrorResponses,
  validationErrorResponse,
} from '../shared/responses.js'
import {
  BrandCharacterLinkSchema,
  BrandCharacterParamsSchema,
  BrandCharactersResponseSchema,
  BrandIdParamsSchema,
  CharacterDetailSchema,
  CharacterIdParamsSchema,
  CharacterSchema,
  CreateCharacterRequestSchema,
  LinkBrandCharacterRequestSchema,
  ListCharactersQuerySchema,
  ListCharactersResponseSchema,
  UpdateCharacterRequestSchema,
} from './characters.schemas.js'

const notFound = notFoundErrorResponse('Resource')
const listRoute = createRoute({
  method: 'get',
  path: '/characters',
  operationId: 'listCharacters',
  tags: ['Characters'],
  request: { query: ListCharactersQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ListCharactersResponseSchema } },
      description: 'Characters in the active organization',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
  },
})
const createDefinition = createRoute({
  method: 'post',
  path: '/characters',
  operationId: 'createCharacter',
  tags: ['Characters'],
  request: {
    body: {
      content: { 'application/json': { schema: CreateCharacterRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CharacterSchema } },
      description: 'Created character',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
    404: notFound,
  },
})
const getRoute = createRoute({
  method: 'get',
  path: '/characters/{characterId}',
  operationId: 'getCharacter',
  tags: ['Characters'],
  request: { params: CharacterIdParamsSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: CharacterDetailSchema } },
      description: 'Character detail',
    },
    ...organizationErrorResponses,
    404: notFound,
  },
})
const updateRoute = createRoute({
  method: 'patch',
  path: '/characters/{characterId}',
  operationId: 'updateCharacter',
  tags: ['Characters'],
  request: {
    params: CharacterIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateCharacterRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CharacterSchema } },
      description: 'Updated character',
    },
    400: validationErrorResponse,
    ...organizationErrorResponses,
    404: notFound,
  },
})
const deleteRoute = createRoute({
  method: 'delete',
  path: '/characters/{characterId}',
  operationId: 'deleteCharacter',
  tags: ['Characters'],
  request: { params: CharacterIdParamsSchema },
  responses: {
    204: { description: 'Deleted character' },
    ...organizationErrorResponses,
    404: notFound,
  },
})
const linkRoute = createRoute({
  method: 'post',
  path: '/brands/{brandId}/characters',
  operationId: 'linkBrandCharacter',
  tags: ['Characters'],
  request: {
    params: BrandIdParamsSchema,
    body: {
      content: {
        'application/json': { schema: LinkBrandCharacterRequestSchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: BrandCharacterLinkSchema } },
      description: 'Linked character',
    },
    ...organizationErrorResponses,
    404: notFound,
  },
})
const listBrandCharactersRoute = createRoute({
  method: 'get',
  path: '/brands/{brandId}/characters',
  operationId: 'listBrandCharacters',
  tags: ['Characters'],
  request: { params: BrandIdParamsSchema },
  responses: {
    200: {
      content: {
        'application/json': { schema: BrandCharactersResponseSchema },
      },
      description: 'Characters linked to the brand',
    },
    ...organizationErrorResponses,
    404: notFound,
  },
})
const unlinkRoute = createRoute({
  method: 'delete',
  path: '/brands/{brandId}/characters/{characterId}',
  operationId: 'unlinkBrandCharacter',
  tags: ['Characters'],
  request: { params: BrandCharacterParamsSchema },
  responses: {
    204: { description: 'Unlinked character' },
    ...organizationErrorResponses,
    404: notFound,
  },
})

export function registerCharacterRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(listRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const result = await listCharacters({
      organizationId,
      ...c.req.valid('query'),
    })
    return result.ok
      ? c.json({ data: result.data, nextCursor: result.nextCursor }, 200)
      : c.json(invalidCursorError, 400)
  })
  app.openapi(createDefinition, async (c) => {
    const context = requireOrganization(c)
    const result = await createCharacter({
      ...context,
      ...c.req.valid('json'),
      createdBy: context.userId,
    })
    return result.ok
      ? c.json(result.character, 201)
      : c.json(
          apiError('not_found', 'One or more brands were not found.'),
          404,
        )
  })
  app.openapi(getRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const character = await getCharacter(
      organizationId,
      c.req.valid('param').characterId,
    )
    return character
      ? c.json(character, 200)
      : c.json(apiError('not_found', 'Character not found.'), 404)
  })
  app.openapi(updateRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const result = await editCharacter({
      ...c.req.valid('json'),
      organizationId,
      characterId: c.req.valid('param').characterId,
    })
    return result.ok
      ? c.json(result.character, 200)
      : c.json(
          apiError(
            'not_found',
            result.reason === 'brand_not_found'
              ? 'One or more brands were not found.'
              : 'Character not found.',
          ),
          404,
        )
  })
  app.openapi(deleteRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    return (await removeCharacter(
      organizationId,
      c.req.valid('param').characterId,
    ))
      ? c.body(null, 204)
      : c.json(apiError('not_found', 'Character not found.'), 404)
  })
  app.openapi(linkRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const brandId = c.req.valid('param').brandId
    const characterId = c.req.valid('json').characterId
    return (await addCharacterToBrand(organizationId, brandId, characterId))
      ? c.json({ brandId, characterId }, 201)
      : c.json(apiError('not_found', 'Brand or character not found.'), 404)
  })
  app.openapi(listBrandCharactersRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const { brandId } = c.req.valid('param')
    const characters = await listBrandCharacters(organizationId, brandId)

    return characters
      ? c.json({ data: characters }, 200)
      : c.json(apiError('not_found', 'Brand not found.'), 404)
  })
  app.openapi(unlinkRoute, async (c) => {
    const { organizationId } = requireOrganization(c)
    const { brandId, characterId } = c.req.valid('param')
    return (await removeCharacterFromBrand(
      organizationId,
      brandId,
      characterId,
    ))
      ? c.body(null, 204)
      : c.json(apiError('not_found', 'Brand or character not found.'), 404)
  })
}
