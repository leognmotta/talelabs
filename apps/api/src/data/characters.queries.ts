import type { PageCursor } from './cursor.js'
import { db } from '@talelabs/db'

const columns = [
  'id',
  'name',
  'role',
  'description',
  'personality',
  'visualNotes',
  'createdBy',
  'createdAt',
  'updatedAt',
] as const

export function findCharacters(input: {
  brandId?: string
  cursor: PageCursor | null
  limit: number
  organizationId: string
  search?: string
}) {
  let query = db
    .selectFrom('characters')
    .select(columns)
    .where('organizationId', '=', input.organizationId)
  if (input.brandId) {
    const brandId = input.brandId
    query = query.where(eb =>
      eb.exists(
        eb
          .selectFrom('brandCharacters')
          .select('brandId')
          .whereRef('brandCharacters.characterId', '=', 'characters.id')
          .where('brandCharacters.brandId', '=', brandId),
      ),
    )
  }
  if (input.search)
    query = query.where('name', 'ilike', `%${input.search}%`)
  if (input.cursor) {
    const cursor = input.cursor
    query = query.where(eb =>
      eb.or([
        eb('createdAt', '<', cursor.createdAt),
        eb.and([
          eb('createdAt', '=', cursor.createdAt),
          eb('id', '<', cursor.id),
        ]),
      ]),
    )
  }
  return query
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(input.limit + 1)
    .execute()
}
export function findCharacterById(organizationId: string, characterId: string) {
  return db
    .selectFrom('characters')
    .select(columns)
    .where('organizationId', '=', organizationId)
    .where('id', '=', characterId)
    .executeTakeFirst()
}
export function findCharacterBrandLinks(characterIds: string[]) {
  return characterIds.length
    ? db
        .selectFrom('brandCharacters')
        .select(['brandId', 'characterId'])
        .where('characterId', 'in', characterIds)
        .execute()
    : Promise.resolve([])
}

export function findCharactersByBrand(organizationId: string, brandId: string) {
  return db
    .selectFrom('characters')
    .select(columns)
    .where('organizationId', '=', organizationId)
    .where(eb =>
      eb.exists(
        eb
          .selectFrom('brandCharacters')
          .select('brandId')
          .whereRef('brandCharacters.characterId', '=', 'characters.id')
          .where('brandCharacters.brandId', '=', brandId),
      ),
    )
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .execute()
}

export function insertCharacterWithBrands(input: {
  brandIds: string[]
  createdBy: string
  description: string | null
  id: string
  name: string
  organizationId: string
  personality: string | null
  role: string | null
  visualNotes: string | null
}) {
  return db.transaction().execute(async (trx) => {
    if (input.brandIds.length) {
      const brands = await trx
        .selectFrom('brands')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('id', 'in', input.brandIds)
        .execute()
      if (brands.length !== input.brandIds.length)
        return null
    }
    const row = await trx
      .insertInto('characters')
      .values({
        createdBy: input.createdBy,
        description: input.description,
        id: input.id,
        name: input.name,
        organizationId: input.organizationId,
        personality: input.personality,
        role: input.role,
        visualNotes: input.visualNotes,
      })
      .returning(columns)
      .executeTakeFirstOrThrow()
    if (input.brandIds.length) {
      await trx
        .insertInto('brandCharacters')
        .values(
          input.brandIds.map(brandId => ({ brandId, characterId: input.id })),
        )
        .execute()
    }
    return row
  })
}
export function updateCharacterWithBrands(input: {
  brandIds?: string[]
  characterId: string
  description?: string | null
  name?: string
  organizationId: string
  personality?: string | null
  role?: string | null
  visualNotes?: string | null
}) {
  return db.transaction().execute(async (trx) => {
    const character = await trx
      .selectFrom('characters')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.characterId)
      .executeTakeFirst()

    if (!character)
      return { ok: false, reason: 'not_found' } as const

    if (input.brandIds) {
      const brands
        = input.brandIds.length > 0
          ? await trx
              .selectFrom('brands')
              .select('id')
              .where('organizationId', '=', input.organizationId)
              .where('id', 'in', input.brandIds)
              .execute()
          : []

      if (brands.length !== input.brandIds.length)
        return { ok: false, reason: 'brand_not_found' } as const
    }

    const row = await trx
      .updateTable('characters')
      .set({
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.personality !== undefined
          ? { personality: input.personality }
          : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.visualNotes !== undefined
          ? { visualNotes: input.visualNotes }
          : {}),
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.characterId)
      .returning(columns)
      .executeTakeFirstOrThrow()

    if (input.brandIds) {
      await trx
        .deleteFrom('brandCharacters')
        .where('characterId', '=', input.characterId)
        .execute()

      if (input.brandIds.length > 0) {
        await trx
          .insertInto('brandCharacters')
          .values(
            input.brandIds.map(brandId => ({
              brandId,
              characterId: input.characterId,
            })),
          )
          .execute()
      }
    }

    return { ok: true, row } as const
  })
}
export async function deleteCharacter(
  organizationId: string,
  characterId: string,
) {
  const row = await db
    .deleteFrom('characters')
    .where('organizationId', '=', organizationId)
    .where('id', '=', characterId)
    .returning('id')
    .executeTakeFirst()
  return Boolean(row)
}
export function countCharacterAssets(characterId: string) {
  return db
    .selectFrom('characterAssets')
    .select('role')
    .select(eb => eb.fn.countAll<number>().as('count'))
    .where('characterId', '=', characterId)
    .groupBy('role')
    .execute()
}

export function linkBrandCharacter(
  organizationId: string,
  brandId: string,
  characterId: string,
) {
  return db.transaction().execute(async (trx) => {
    const [brand, character] = await Promise.all([
      trx
        .selectFrom('brands')
        .select('id')
        .where('organizationId', '=', organizationId)
        .where('id', '=', brandId)
        .executeTakeFirst(),
      trx
        .selectFrom('characters')
        .select('id')
        .where('organizationId', '=', organizationId)
        .where('id', '=', characterId)
        .executeTakeFirst(),
    ])
    if (!brand || !character)
      return false
    await trx
      .insertInto('brandCharacters')
      .values({ brandId, characterId })
      .onConflict(oc => oc.columns(['brandId', 'characterId']).doNothing())
      .execute()
    return true
  })
}
export async function unlinkBrandCharacter(
  organizationId: string,
  brandId: string,
  characterId: string,
) {
  const [brand, character] = await Promise.all([
    db
      .selectFrom('brands')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('id', '=', brandId)
      .executeTakeFirst(),
    db
      .selectFrom('characters')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('id', '=', characterId)
      .executeTakeFirst(),
  ])
  if (!brand || !character)
    return false
  await db
    .deleteFrom('brandCharacters')
    .where('brandId', '=', brandId)
    .where('characterId', '=', characterId)
    .execute()
  return true
}
