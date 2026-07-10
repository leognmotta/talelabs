import { createId } from '@paralleldrive/cuid2'
import { decodeCursor } from '../data/cursor.js'
import {
  brandExists,
  countProductAssets,
  deleteProduct,
  findProductById,
  findProducts,
  insertProduct,
  updateProduct,
} from '../data/products.queries.js'
import { buildCursorPage, invalidCursorResult } from './shared/pagination.js'
import {
  serializeRoleCounts,
  serializeTimestamps,
} from './shared/serialization.js'
import { normalizeNullableText, normalizeTextList } from './shared/text.js'

export async function listProducts(input: {
  brandId?: string
  cursor?: string
  limit: number
  organizationId: string
  search?: string
}) {
  const decoded = decodeCursor(input.cursor)
  if (!decoded.ok)
    return invalidCursorResult
  const rows = await findProducts({
    ...input,
    cursor: decoded.cursor,
    search: input.search?.trim() || undefined,
  })
  const page = buildCursorPage(rows, input.limit, serializeTimestamps)
  return { ok: true, data: page.data, nextCursor: page.nextCursor } as const
}

export async function getProduct(organizationId: string, productId: string) {
  const row = await findProductById(organizationId, productId)
  if (!row)
    return null
  const counts = await countProductAssets(productId)
  return {
    ...serializeTimestamps(row),
    kitCounts: serializeRoleCounts(counts),
  }
}

export async function createProduct(input: {
  benefits?: string[]
  brandId?: string
  createdBy: string
  description?: string
  features?: string[]
  name: string
  organizationId: string
}) {
  if (
    input.brandId
    && !(await brandExists(input.organizationId, input.brandId))
  ) {
    return { ok: false, reason: 'brand_not_found' } as const
  }
  const row = await insertProduct({
    benefits: normalizeTextList(input.benefits) ?? [],
    brandId: input.brandId ?? null,
    createdBy: input.createdBy,
    description: normalizeNullableText(input.description) ?? null,
    features: normalizeTextList(input.features) ?? [],
    id: createId(),
    name: input.name.trim(),
    organizationId: input.organizationId,
  })
  return { ok: true, product: serializeTimestamps(row) } as const
}

export async function editProduct(input: {
  benefits?: string[]
  brandId?: string | null
  description?: string | null
  features?: string[]
  name?: string
  organizationId: string
  productId: string
}) {
  if (
    input.brandId
    && !(await brandExists(input.organizationId, input.brandId))
  ) {
    return { ok: false, reason: 'brand_not_found' } as const
  }
  const row = await updateProduct({
    ...input,
    benefits: normalizeTextList(input.benefits),
    description: normalizeNullableText(input.description),
    features: normalizeTextList(input.features),
    name: input.name?.trim(),
  })
  return row
    ? ({ ok: true, product: serializeTimestamps(row) } as const)
    : ({ ok: false, reason: 'not_found' } as const)
}

export function removeProduct(organizationId: string, productId: string) {
  return deleteProduct(organizationId, productId)
}
