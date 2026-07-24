/**
 * Tenant- and owner-scoped persistence for lightweight Create sessions.
 *
 * Sessions group direct runs only. They never own Flow graphs, nodes, edges,
 * revisions, or server-side drafts.
 */

import type {
  CreateSessionTable,
  Database,
  Transaction,
} from '@talelabs/db'
import type { Selectable } from 'kysely'
import type { PageCursor } from '../pagination/cursor.js'

import { db, sql } from '@talelabs/db'

/** One persisted Create session row. */
export type CreateSessionRecord = Selectable<CreateSessionTable>

/** Lists owned, non-deleted sessions with stable updated-at pagination. */
export function listCreateSessionRows(input: {
  /** Parsed cursor for the previous page. */
  cursor: PageCursor<'updatedAt'> | null
  /** Maximum page size excluding the look-ahead row. */
  limit: number
  /** Active tenant scope. */
  organizationId: string
  /** Optional case-insensitive name filter. */
  search?: string
  /** Authenticated session owner. */
  userId: string
}) {
  let query = db.selectFrom('createSessions')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('createdBy', '=', input.userId)
    .where('deletedAt', 'is', null)

  if (input.search) {
    const escaped = input.search.replace(/[\\%_]/g, match => `\\${match}`)
    query = query.where(
      sql<boolean>`"name" ilike ${`%${escaped}%`} escape '\\'`,
    )
  }
  if (input.cursor) {
    const updatedAt = new Date(String(input.cursor.sortValue))
    query = query.where(eb => eb.or([
      eb('updatedAt', '<', updatedAt),
      eb.and([
        eb('updatedAt', '=', updatedAt),
        eb('id', '<', input.cursor!.id),
      ]),
    ]))
  }
  return query
    .orderBy('updatedAt', 'desc')
    .orderBy('id', 'desc')
    .limit(input.limit + 1)
    .execute()
}

/** Loads one owned, non-deleted Create session. */
export function findCreateSessionRow(input: {
  /** Session route identity. */
  id: string
  /** Active tenant scope. */
  organizationId: string
  /** Authenticated session owner. */
  userId: string
}) {
  return db.selectFrom('createSessions')
    .selectAll()
    .where('id', '=', input.id)
    .where('organizationId', '=', input.organizationId)
    .where('createdBy', '=', input.userId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
}

/** Locks one active session owned by the authenticated creator. */
export async function lockOwnedCreateSessionRow(input: {
  /** Session identity supplied by admission or retry. */
  id: string
  /** Active tenant scope. */
  organizationId: string
  /** Authenticated session owner. */
  userId: string
  /** Caller-owned transaction preserving lifecycle serialization. */
  trx: Transaction<Database>
}) {
  return input.trx.selectFrom('createSessions')
    .select('id')
    .where('id', '=', input.id)
    .where('organizationId', '=', input.organizationId)
    .where('createdBy', '=', input.userId)
    .where('deletedAt', 'is', null)
    .forUpdate()
    .executeTakeFirst()
}

/**
 * Resolves an existing owned session or creates one during run admission.
 *
 * Existing rows are locked so deletion and direct admission cannot cross.
 */
export async function resolveCreateSessionForAdmission(input: {
  /** Existing session supplied by the client, or null for first generation. */
  createSessionId: null | string
  /** Authenticated user persisted as session owner. */
  createdBy: string
  /** Stable preallocated identity used only when creating a session. */
  newSessionId: string
  /** Active tenant scope. */
  organizationId: string
  /** Caller-owned admission transaction. */
  trx: Transaction<Database>
}): Promise<null | string> {
  if (!input.createSessionId) {
    await input.trx.insertInto('createSessions').values({
      createdBy: input.createdBy,
      id: input.newSessionId,
      name: null,
      organizationId: input.organizationId,
    }).execute()
    return input.newSessionId
  }

  const session = await lockOwnedCreateSessionRow({
    id: input.createSessionId,
    organizationId: input.organizationId,
    trx: input.trx,
    userId: input.createdBy,
  })
  return session?.id ?? null
}

/** Touches a session after a direct run is admitted into it. */
export function touchCreateSessionRow(
  trx: Transaction<Database>,
  organizationId: string,
  sessionId: string,
) {
  return trx.updateTable('createSessions')
    .set({ updatedAt: new Date() })
    .where('id', '=', sessionId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

/** Renames one owned, non-deleted session and returns the updated row. */
export function renameCreateSessionRow(input: {
  /** Session identity. */
  id: string
  /** Trimmed user-authored label. */
  name: string
  /** Active tenant scope. */
  organizationId: string
  /** Authenticated session owner. */
  userId: string
}) {
  return db.updateTable('createSessions')
    .set({ name: input.name, updatedAt: new Date() })
    .where('id', '=', input.id)
    .where('organizationId', '=', input.organizationId)
    .where('createdBy', '=', input.userId)
    .where('deletedAt', 'is', null)
    .returningAll()
    .executeTakeFirst()
}

/** Soft-deletes one owned session while preserving runs and output Assets. */
export function deleteCreateSessionRow(input: {
  /** Session identity. */
  id: string
  /** Active tenant scope. */
  organizationId: string
  /** Authenticated session owner. */
  userId: string
}) {
  const deletedAt = new Date()
  return db.updateTable('createSessions')
    .set({ deletedAt, updatedAt: deletedAt })
    .where('id', '=', input.id)
    .where('organizationId', '=', input.organizationId)
    .where('createdBy', '=', input.userId)
    .where('deletedAt', 'is', null)
    .returning('id')
    .executeTakeFirst()
}
