import type { PageCursor } from './cursor.js'
import { db } from '@talelabs/db'

const columns = ['id', 'brandId', 'name', 'description', 'features', 'benefits', 'createdBy', 'createdAt', 'updatedAt'] as const

export function findProducts(input: { brandId?: string, cursor: PageCursor | null, limit: number, organizationId: string, search?: string }) {
  let query = db.selectFrom('products').select(columns).where('organizationId', '=', input.organizationId)
  if (input.brandId)
    query = query.where('brandId', '=', input.brandId)
  if (input.search)
    query = query.where('name', 'ilike', `%${input.search}%`)
  if (input.cursor) {
    const cursor = input.cursor
    query = query.where(eb => eb.or([
      eb('createdAt', '<', cursor.createdAt),
      eb.and([eb('createdAt', '=', cursor.createdAt), eb('id', '<', cursor.id)]),
    ]))
  }
  return query.orderBy('createdAt', 'desc').orderBy('id', 'desc').limit(input.limit + 1).execute()
}

export function findProductById(organizationId: string, productId: string) {
  return db.selectFrom('products').select(columns).where('organizationId', '=', organizationId).where('id', '=', productId).executeTakeFirst()
}

export async function brandExists(organizationId: string, brandId: string) {
  return Boolean(await db.selectFrom('brands').select('id').where('organizationId', '=', organizationId).where('id', '=', brandId).executeTakeFirst())
}

export function insertProduct(input: { benefits: string[], brandId: string | null, createdBy: string, description: string | null, features: string[], id: string, name: string, organizationId: string }) {
  return db.insertInto('products').values(input).returning(columns).executeTakeFirstOrThrow()
}

export function updateProduct(input: { benefits?: string[], brandId?: string | null, description?: string | null, features?: string[], name?: string, organizationId: string, productId: string }) {
  return db.updateTable('products').set({
    ...(input.benefits !== undefined ? { benefits: input.benefits } : {}),
    ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.features !== undefined ? { features: input.features } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    updatedAt: new Date(),
  }).where('organizationId', '=', input.organizationId).where('id', '=', input.productId).returning(columns).executeTakeFirst()
}

export async function deleteProduct(organizationId: string, productId: string) {
  return Boolean(await db.deleteFrom('products').where('organizationId', '=', organizationId).where('id', '=', productId).returning('id').executeTakeFirst())
}

export function countProductAssets(productId: string) {
  return db.selectFrom('productAssets').select('role').select(eb => eb.fn.countAll<number>().as('count')).where('productId', '=', productId).groupBy('role').execute()
}
