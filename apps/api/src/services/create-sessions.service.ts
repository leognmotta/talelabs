/**
 * Create-session workflows for list, read, rename, and soft deletion.
 *
 * Session mutations never modify runs, generated Assets, or immutable
 * generation provenance.
 */

import type { CreateSessionRecord } from '../data/create-sessions.data.js'

import {
  deleteCreateSessionRow,
  findCreateSessionRow,
  listCreateSessionRows,
  renameCreateSessionRow,
} from '../data/create-sessions.data.js'
import {
  HttpError,
  TenantResourceNotFoundError,
} from '../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../pagination/pagination.js'

function presentCreateSession(session: CreateSessionRecord) {
  return {
    createdAt: session.createdAt.toISOString(),
    id: session.id,
    name: session.name,
    updatedAt: session.updatedAt.toISOString(),
  }
}

/** Lists the authenticated user's non-deleted sessions in one tenant. */
export async function listCreateSessions(input: {
  /** Opaque updated-at cursor. */
  cursor?: string
  /** Requested bounded page size. */
  limit: number
  /** Active tenant scope. */
  organizationId: string
  /** Optional user-authored name search. */
  search?: string
  /** Authenticated session owner. */
  userId: string
}) {
  const pagination = resolvePagination(
    { cursor: input.cursor, limit: input.limit },
    {
      cursorValueParsers: { updatedAt: parseIsoTimestampCursorValue },
      defaultOrder: 'desc',
      defaultSort: 'updatedAt',
    },
  )
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The pagination options are invalid.',
      pagination.details,
    )
  }
  const rows = await listCreateSessionRows({
    cursor: pagination.value.cursor,
    limit: pagination.value.limit,
    organizationId: input.organizationId,
    search: input.search,
    userId: input.userId,
  })
  const page = buildCursorPage({
    cursorFromRow: row => ({
      id: row.id,
      order: 'desc' as const,
      sort: 'updatedAt' as const,
      sortValue: row.updatedAt.toISOString(),
    }),
    limit: pagination.value.limit,
    rows,
    serialize: row => row,
  })
  return {
    data: page.pageRows.map(presentCreateSession),
    nextCursor: page.nextCursor,
  }
}

/** Loads one owned, non-deleted session. */
export async function getCreateSession(input: {
  /** Session route identity. */
  id: string
  /** Active tenant scope. */
  organizationId: string
  /** Authenticated session owner. */
  userId: string
}) {
  const session = await findCreateSessionRow(input)
  if (!session)
    throw new TenantResourceNotFoundError()
  return presentCreateSession(session)
}

/** Renames one owned session. */
export async function renameCreateSession(input: {
  /** Session route identity. */
  id: string
  /** Trimmed user-authored name. */
  name: string
  /** Active tenant scope. */
  organizationId: string
  /** Authenticated session owner. */
  userId: string
}) {
  const session = await renameCreateSessionRow(input)
  if (!session)
    throw new TenantResourceNotFoundError()
  return presentCreateSession(session)
}

/** Hides one owned session while retaining run and Asset provenance. */
export async function deleteCreateSession(input: {
  /** Session route identity. */
  id: string
  /** Active tenant scope. */
  organizationId: string
  /** Authenticated session owner. */
  userId: string
}) {
  const deleted = await deleteCreateSessionRow(input)
  if (!deleted)
    throw new TenantResourceNotFoundError()
}
