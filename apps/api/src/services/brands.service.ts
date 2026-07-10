import type { BrandColor } from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'
import {
  countBrandAssets,
  deleteBrand,
  findBrandById,
  findBrands,
  insertBrand,
  updateBrand,
} from '../data/brands.queries.js'
import { decodeCursor } from '../data/cursor.js'
import { buildCursorPage, invalidCursorResult } from './shared/pagination.js'
import { serializeRoleCounts } from './shared/serialization.js'
import { normalizeNullableText } from './shared/text.js'

interface NullableProfileFields {
  description?: string | null
  doRules?: string | null
  dontRules?: string | null
  toneOfVoice?: string | null
  visualStyle?: string | null
}

function normalizeFields(input: NullableProfileFields) {
  return {
    description: normalizeNullableText(input.description),
    doRules: normalizeNullableText(input.doRules),
    dontRules: normalizeNullableText(input.dontRules),
    toneOfVoice: normalizeNullableText(input.toneOfVoice),
    visualStyle: normalizeNullableText(input.visualStyle),
  }
}

function toBrand(row: {
  colors: BrandColor[]
  createdAt: Date
  createdBy: string | null
  description: string | null
  doRules: string | null
  dontRules: string | null
  id: string
  name: string
  toneOfVoice: string | null
  updatedAt: Date
  visualStyle: string | null
}) {
  return {
    colors: row.colors.map(color => ({ hex: color.hex, name: color.name })),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    description: row.description,
    doRules: row.doRules,
    dontRules: row.dontRules,
    id: row.id,
    name: row.name,
    toneOfVoice: row.toneOfVoice,
    updatedAt: row.updatedAt.toISOString(),
    visualStyle: row.visualStyle,
  }
}

export async function listBrands(input: {
  cursor?: string
  limit: number
  organizationId: string
  search?: string
}) {
  const decoded = decodeCursor(input.cursor)
  if (!decoded.ok)
    return invalidCursorResult

  const rows = await findBrands({
    cursor: decoded.cursor,
    limit: input.limit,
    organizationId: input.organizationId,
    search: input.search?.trim() || undefined,
  })
  const page = buildCursorPage(rows, input.limit, toBrand)
  return {
    ok: true,
    data: page.data,
    nextCursor: page.nextCursor,
  } as const
}

export async function getBrand(organizationId: string, brandId: string) {
  const row = await findBrandById(organizationId, brandId)
  if (!row)
    return null
  const counts = await countBrandAssets(brandId)
  return {
    ...toBrand(row),
    kitCounts: serializeRoleCounts(counts),
  }
}

export async function createBrand(input: NullableProfileFields & {
  colors?: BrandColor[]
  createdBy: string
  name: string
  organizationId: string
}) {
  const fields = normalizeFields(input)
  const row = await insertBrand({
    colors: input.colors ?? [],
    createdBy: input.createdBy,
    description: fields.description ?? null,
    doRules: fields.doRules ?? null,
    dontRules: fields.dontRules ?? null,
    id: createId(),
    name: input.name.trim(),
    organizationId: input.organizationId,
    toneOfVoice: fields.toneOfVoice ?? null,
    visualStyle: fields.visualStyle ?? null,
  })
  return toBrand(row)
}

export async function editBrand(input: NullableProfileFields & {
  brandId: string
  colors?: BrandColor[]
  name?: string
  organizationId: string
}) {
  const row = await updateBrand({
    ...normalizeFields(input),
    brandId: input.brandId,
    colors: input.colors,
    name: input.name?.trim(),
    organizationId: input.organizationId,
  })
  return row ? toBrand(row) : null
}

export function removeBrand(organizationId: string, brandId: string) {
  return deleteBrand(organizationId, brandId)
}
