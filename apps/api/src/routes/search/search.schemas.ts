import { z } from '@hono/zod-openapi'

import { AssetTypeSchema, Cuid2Schema } from '../../schemas/common.js'
import { ElementTypeSchema } from '../elements/elements.schemas.js'

export const SearchTypeSchema = z.enum(['asset', 'element', 'folder']).openapi('SearchType')

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  type: z.union([SearchTypeSchema, z.array(SearchTypeSchema)]).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

export const SearchAssetSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  type: AssetTypeSchema,
  thumbnailUrl: z.url().nullable(),
}).openapi('SearchAsset')

export const SearchFolderSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  path: z.string(),
}).openapi('SearchFolder')

export const SearchElementSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  type: ElementTypeSchema,
  thumbnailUrl: z.url().nullable(),
}).openapi('SearchElement')

export const SearchResponseSchema = z.object({
  assets: z.array(SearchAssetSchema).max(10),
  elements: z.array(SearchElementSchema).max(10),
  folders: z.array(SearchFolderSchema).max(10),
}).openapi('SearchResponse')
