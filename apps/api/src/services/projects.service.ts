import { createId } from '@paralleldrive/cuid2'
import { decodeCursor } from '../data/cursor.js'
import {
  deleteProject,
  findProjectById,
  findProjects,
  insertProject,
  updateProject,
} from '../data/projects.queries.js'
import { buildCursorPage, invalidCursorResult } from './shared/pagination.js'
import { serializeTimestamps } from './shared/serialization.js'
import { normalizeNullableText } from './shared/text.js'

interface ProjectRow {
  id: string
  name: string
  description: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

function toProject(row: ProjectRow) {
  return serializeTimestamps(row)
}

export async function listProjects(input: {
  cursor?: string
  limit: number
  organizationId: string
  search?: string
}) {
  const decoded = decodeCursor(input.cursor)

  if (!decoded.ok)
    return invalidCursorResult

  const rows = await findProjects({
    cursor: decoded.cursor,
    limit: input.limit,
    organizationId: input.organizationId,
    search: input.search?.trim() || undefined,
  })
  const page = buildCursorPage(rows, input.limit, toProject)

  return {
    ok: true,
    data: page.data,
    nextCursor: page.nextCursor,
  } as const
}

export async function getProject(organizationId: string, projectId: string) {
  const row = await findProjectById(organizationId, projectId)
  return row ? toProject(row) : null
}

export async function createProject(input: {
  createdBy: string
  description?: string
  name: string
  organizationId: string
}) {
  const row = await insertProject({
    createdBy: input.createdBy,
    description: normalizeNullableText(input.description) ?? null,
    id: createId(),
    name: input.name.trim(),
    organizationId: input.organizationId,
  })

  return toProject(row)
}

export async function editProject(input: {
  description?: string | null
  name?: string
  organizationId: string
  projectId: string
}) {
  const row = await updateProject({
    description: normalizeNullableText(input.description),
    name: input.name?.trim(),
    organizationId: input.organizationId,
    projectId: input.projectId,
  })

  return row ? toProject(row) : null
}

export function removeProject(organizationId: string, projectId: string) {
  return deleteProject(organizationId, projectId)
}
