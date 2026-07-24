/** Shared tenant-safe validation for optional Project assignment. */

import type { Database, Transaction } from '@talelabs/db'
import type { Kysely } from 'kysely'

import { db, sql } from '@talelabs/db'

import { TenantResourceNotFoundError } from '../../middleware/error.js'

/** Database executor accepted by Project scope checks. */
export type ProjectScopeExecutor = Kysely<Database> | Transaction<Database>

/**
 * Serializes Project-content moves, Brief saves, and archive-sensitive work.
 *
 * Sorting makes multi-Project moves acquire the same advisory-lock order.
 */
export async function lockProjectScopes(
  executor: Transaction<Database>,
  organizationId: string,
  projectIds: readonly (null | string)[],
) {
  const scopes = [...new Set(projectIds.map(id => id ?? 'private'))].sort()
  for (const scope of scopes) {
    await sql`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${`talelabs:project-scope:${organizationId}:${scope}`},
          0
        )
      )
    `.execute(executor)
  }
}

/** Loads one tenant-owned Project without treating archive state as access. */
export async function requireProject(
  organizationId: string,
  projectId: string,
  executor: ProjectScopeExecutor = db,
) {
  const project = await executor.selectFrom('projects')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', projectId)
    .executeTakeFirst()
  if (!project)
    throw new TenantResourceNotFoundError('projectId')
  return project
}

/**
 * Locks one optional active Project during assignment or run admission.
 *
 * The shared row lock serializes assignment with Project archive.
 */
export async function lockActiveProject(
  executor: Transaction<Database>,
  organizationId: string,
  projectId: null | string,
  field = 'projectId',
) {
  if (!projectId)
    return null

  const project = await executor.selectFrom('projects')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', projectId)
    .where('archivedAt', 'is', null)
    .forShare()
    .executeTakeFirst()
  if (!project)
    throw new TenantResourceNotFoundError(field)
  return project
}

/**
 * Locks every non-Private Project in deterministic order and requires it active.
 *
 * Callers first acquire the matching advisory scopes with `lockProjectScopes`;
 * this helper then protects both source and destination Projects for mutations.
 */
export async function lockActiveProjects(
  executor: Transaction<Database>,
  organizationId: string,
  projectIds: readonly (null | string)[],
  field = 'projectId',
) {
  const ids = [...new Set(
    projectIds.filter((id): id is string => Boolean(id)),
  )].sort()
  for (const projectId of ids)
    await lockActiveProject(executor, organizationId, projectId, field)
}

/** Touches one Project after a successful owned-content mutation. */
export function touchProject(
  executor: ProjectScopeExecutor,
  organizationId: string,
  projectId: null | string,
) {
  if (!projectId)
    return Promise.resolve(undefined)

  return executor.updateTable('projects')
    .set({ updatedAt: new Date() })
    .where('organizationId', '=', organizationId)
    .where('id', '=', projectId)
    .executeTakeFirst()
}
