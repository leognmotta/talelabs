import type { PageCursor } from './cursor.js'

import { db } from '@talelabs/db'

const projectColumns = [
  'id',
  'name',
  'description',
  'createdBy',
  'createdAt',
  'updatedAt',
] as const

export function findProjects(input: {
  cursor: PageCursor | null
  limit: number
  organizationId: string
  search?: string
}) {
  let query = db
    .selectFrom('projects')
    .select(projectColumns)
    .where('organizationId', '=', input.organizationId)

  if (input.search) {
    query = query.where('name', 'ilike', `%${input.search}%`)
  }

  if (input.cursor) {
    query = query.where(eb => eb.or([
      eb('createdAt', '<', input.cursor!.createdAt),
      eb.and([
        eb('createdAt', '=', input.cursor!.createdAt),
        eb('id', '<', input.cursor!.id),
      ]),
    ]))
  }

  return query
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(input.limit + 1)
    .execute()
}

export function findProjectById(organizationId: string, projectId: string) {
  return db
    .selectFrom('projects')
    .select(projectColumns)
    .where('organizationId', '=', organizationId)
    .where('id', '=', projectId)
    .executeTakeFirst()
}

export function insertProject(input: {
  createdBy: string
  description: string | null
  id: string
  name: string
  organizationId: string
}) {
  return db
    .insertInto('projects')
    .values(input)
    .returning(projectColumns)
    .executeTakeFirstOrThrow()
}

export function updateProject(input: {
  description?: string | null
  name?: string
  organizationId: string
  projectId: string
}) {
  return db
    .updateTable('projects')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.projectId)
    .returning(projectColumns)
    .executeTakeFirst()
}

export async function deleteProject(organizationId: string, projectId: string) {
  const result = await db
    .deleteFrom('projects')
    .where('organizationId', '=', organizationId)
    .where('id', '=', projectId)
    .returning('id')
    .executeTakeFirst()

  return Boolean(result)
}
