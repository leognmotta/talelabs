import type { BrandColor } from '@talelabs/db'
import type { PageCursor } from './cursor.js'

import { db } from '@talelabs/db'

const brandColumns = [
  'id',
  'name',
  'description',
  'toneOfVoice',
  'visualStyle',
  'doRules',
  'dontRules',
  'colors',
  'createdBy',
  'createdAt',
  'updatedAt',
] as const

export function findBrands(input: {
  cursor: PageCursor | null
  limit: number
  organizationId: string
  search?: string
}) {
  let query = db.selectFrom('brands').select(brandColumns).where('organizationId', '=', input.organizationId)

  if (input.search)
    query = query.where('name', 'ilike', `%${input.search}%`)

  if (input.cursor) {
    const cursor = input.cursor
    query = query.where(eb => eb.or([
      eb('createdAt', '<', cursor.createdAt),
      eb.and([
        eb('createdAt', '=', cursor.createdAt),
        eb('id', '<', cursor.id),
      ]),
    ]))
  }

  return query.orderBy('createdAt', 'desc').orderBy('id', 'desc').limit(input.limit + 1).execute()
}

export function findBrandById(organizationId: string, brandId: string) {
  return db.selectFrom('brands').select(brandColumns).where('organizationId', '=', organizationId).where('id', '=', brandId).executeTakeFirst()
}

export function insertBrand(input: {
  colors: BrandColor[]
  createdBy: string
  description: string | null
  doRules: string | null
  dontRules: string | null
  id: string
  name: string
  organizationId: string
  toneOfVoice: string | null
  visualStyle: string | null
}) {
  return db.insertInto('brands').values(input).returning(brandColumns).executeTakeFirstOrThrow()
}

export function updateBrand(input: {
  brandId: string
  colors?: BrandColor[]
  description?: string | null
  doRules?: string | null
  dontRules?: string | null
  name?: string
  organizationId: string
  toneOfVoice?: string | null
  visualStyle?: string | null
}) {
  return db.updateTable('brands').set({
    ...(input.colors !== undefined ? { colors: input.colors } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.doRules !== undefined ? { doRules: input.doRules } : {}),
    ...(input.dontRules !== undefined ? { dontRules: input.dontRules } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.toneOfVoice !== undefined ? { toneOfVoice: input.toneOfVoice } : {}),
    ...(input.visualStyle !== undefined ? { visualStyle: input.visualStyle } : {}),
    updatedAt: new Date(),
  }).where('organizationId', '=', input.organizationId).where('id', '=', input.brandId).returning(brandColumns).executeTakeFirst()
}

export async function deleteBrand(organizationId: string, brandId: string) {
  const row = await db.deleteFrom('brands')
    .where('organizationId', '=', organizationId)
    .where('id', '=', brandId)
    .returning('id')
    .executeTakeFirst()
  return Boolean(row)
}

export async function countBrandAssets(brandId: string) {
  return db.selectFrom('brandAssets').select(['role']).select(eb => eb.fn.countAll<number>().as('count')).where('brandId', '=', brandId).groupBy('role').execute()
}
