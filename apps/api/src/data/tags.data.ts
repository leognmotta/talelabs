import { db } from '@talelabs/db'

export function listTagRows(organizationId: string) {
  return db.selectFrom('tags')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .orderBy('normalizedName')
    .orderBy('id')
    .execute()
}

export function findTagRow(organizationId: string, id: string) {
  return db.selectFrom('tags')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function createTagRow(input: {
  id: string
  name: string
  normalizedName: string
  organizationId: string
  userId: string
}) {
  const inserted = await db.insertInto('tags')
    .values({
      createdBy: input.userId,
      id: input.id,
      name: input.name,
      normalizedName: input.normalizedName,
      organizationId: input.organizationId,
    })
    .onConflict(conflict => conflict
      .columns(['organizationId', 'normalizedName'])
      .doNothing())
    .returningAll()
    .executeTakeFirst()

  if (inserted)
    return inserted

  return db.selectFrom('tags')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('normalizedName', '=', input.normalizedName)
    .executeTakeFirstOrThrow()
}

export function deleteTagRow(organizationId: string, id: string) {
  return db.deleteFrom('tags')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst()
}
