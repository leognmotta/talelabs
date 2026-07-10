import { createId } from '@paralleldrive/cuid2'
import { findBrandById } from '../data/brands.queries.js'
import {
  countCharacterAssets,
  deleteCharacter,
  findCharacterBrandLinks,
  findCharacterById,
  findCharacters,
  findCharactersByBrand,
  insertCharacterWithBrands,
  linkBrandCharacter,
  unlinkBrandCharacter,
  updateCharacterWithBrands,
} from '../data/characters.queries.js'
import { decodeCursor } from '../data/cursor.js'
import { buildCursorPage, invalidCursorResult } from './shared/pagination.js'
import {
  serializeRoleCounts,
  serializeTimestamps,
} from './shared/serialization.js'
import { normalizeNullableText } from './shared/text.js'

interface Fields {
  description?: string | null
  personality?: string | null
  role?: string | null
  visualNotes?: string | null
}
function normalize(input: Fields) {
  return {
    description: normalizeNullableText(input.description),
    personality: normalizeNullableText(input.personality),
    role: normalizeNullableText(input.role),
    visualNotes: normalizeNullableText(input.visualNotes),
  }
}
function toCharacter<T extends { createdAt: Date, updatedAt: Date }>(
  row: T,
  brandIds: string[],
) {
  return { ...serializeTimestamps(row), brandIds }
}
function linkMap(links: { brandId: string, characterId: string }[]) {
  const map = new Map<string, string[]>()
  for (const link of links) {
    map.set(link.characterId, [
      ...(map.get(link.characterId) ?? []),
      link.brandId,
    ])
  }
  return map
}

export async function listCharacters(input: {
  brandId?: string
  cursor?: string
  limit: number
  organizationId: string
  search?: string
}) {
  const decoded = decodeCursor(input.cursor)
  if (!decoded.ok)
    return invalidCursorResult
  const rows = await findCharacters({
    ...input,
    cursor: decoded.cursor,
    search: input.search?.trim() || undefined,
  })
  const page = buildCursorPage(rows, input.limit, row => row)
  const brands = linkMap(
    await findCharacterBrandLinks(page.pageRows.map(row => row.id)),
  )
  return {
    ok: true,
    data: page.pageRows.map(row =>
      toCharacter(row, brands.get(row.id) ?? []),
    ),
    nextCursor: page.nextCursor,
  } as const
}
export async function getCharacter(
  organizationId: string,
  characterId: string,
) {
  const row = await findCharacterById(organizationId, characterId)
  if (!row)
    return null
  const [links, counts] = await Promise.all([
    findCharacterBrandLinks([characterId]),
    countCharacterAssets(characterId),
  ])
  return {
    ...toCharacter(
      row,
      links.map(link => link.brandId),
    ),
    kitCounts: serializeRoleCounts(counts),
  }
}

export async function listBrandCharacters(
  organizationId: string,
  brandId: string,
) {
  const brand = await findBrandById(organizationId, brandId)

  if (!brand)
    return null

  const rows = await findCharactersByBrand(organizationId, brandId)
  const links = linkMap(
    await findCharacterBrandLinks(rows.map(row => row.id)),
  )

  return rows.map(row => toCharacter(row, links.get(row.id) ?? []))
}
export async function createCharacter(
  input: Fields & {
    brandIds?: string[]
    createdBy: string
    name: string
    organizationId: string
  },
) {
  const brandIds = [...new Set(input.brandIds ?? [])]
  const fields = normalize(input)
  const row = await insertCharacterWithBrands({
    brandIds,
    createdBy: input.createdBy,
    description: fields.description ?? null,
    id: createId(),
    name: input.name.trim(),
    organizationId: input.organizationId,
    personality: fields.personality ?? null,
    role: fields.role ?? null,
    visualNotes: fields.visualNotes ?? null,
  })
  return row
    ? ({ ok: true, character: toCharacter(row, brandIds) } as const)
    : ({ ok: false } as const)
}
export async function editCharacter(
  input: Fields & {
    brandIds?: string[]
    characterId: string
    name?: string
    organizationId: string
  },
) {
  const brandIds = input.brandIds ? [...new Set(input.brandIds)] : undefined
  const result = await updateCharacterWithBrands({
    ...normalize(input),
    brandIds,
    characterId: input.characterId,
    name: input.name?.trim(),
    organizationId: input.organizationId,
  })

  if (!result.ok)
    return result

  const links = await findCharacterBrandLinks([result.row.id])

  return {
    ok: true,
    character: toCharacter(
      result.row,
      links.map(link => link.brandId),
    ),
  } as const
}
export const removeCharacter = deleteCharacter
export const addCharacterToBrand = linkBrandCharacter
export const removeCharacterFromBrand = unlinkBrandCharacter
