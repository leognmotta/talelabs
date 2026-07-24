/** Transactional user-owned Asset archive, restore, and purge persistence. */

import type { AssetTable, Database } from '@talelabs/db'
import type { Selectable, Transaction } from 'kysely'

import { db } from '@talelabs/db'
import {
  lockActiveProjects,
  lockProjectScopes,
  touchProject,
} from '../domain/projects/project-scope.js'

/** Archives one Asset (reversible) unless it is being purged. */
export async function archiveAssetRow(organizationId: string, id: string) {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('assets')
      .select('projectId')
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .executeTakeFirst()
    if (!initial)
      return undefined
    await lockProjectScopes(trx, organizationId, [initial.projectId])
    await lockActiveProjects(trx, organizationId, [initial.projectId])
    const current = await trx.selectFrom('assets')
      .select('projectId')
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .where('purgeRequestedAt', 'is', null)
      .forUpdate()
      .executeTakeFirst()
    if (!current || current.projectId !== initial.projectId)
      return undefined
    const archivedAt = new Date()
    const archived = await trx.updateTable('assets')
      .set({ deletedAt: archivedAt, updatedAt: archivedAt })
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .where('purgeRequestedAt', 'is', null)
      .returning('id')
      .executeTakeFirst()
    if (archived)
      await touchProject(trx, organizationId, current.projectId)
    return archived
  })
}

/** Un-archives one Asset; guarded against purge-in-progress. */
export async function restoreAssetRow(organizationId: string, id: string) {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('assets')
      .select('projectId')
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .executeTakeFirst()
    if (!initial)
      return undefined
    await lockProjectScopes(trx, organizationId, [initial.projectId])
    await lockActiveProjects(trx, organizationId, [initial.projectId])
    const current = await trx.selectFrom('assets')
      .select('projectId')
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .where('purgeRequestedAt', 'is', null)
      .forUpdate()
      .executeTakeFirst()
    if (!current || current.projectId !== initial.projectId)
      return undefined
    const restored = await trx.updateTable('assets')
      .set({ deletedAt: null, updatedAt: new Date() })
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .where('purgeRequestedAt', 'is', null)
      .returningAll()
      .executeTakeFirst()
    if (restored)
      await touchProject(trx, organizationId, current.projectId)
    return restored
  })
}

/** Outcome of requesting a permanent Asset purge. */
export type PurgeRequestResult
  = | {
    asset: Selectable<AssetTable>
    status: 'already_requested' | 'requested'
  }
  | { status: 'active_generation' }
  | { status: 'location_changed' }
  | { status: 'not_found' }

/**
 * Marks one Asset for permanent purge inside `trx`: archives it, rejects if
 * an active generation consumes it, and detaches it from every Element.
 */
export async function requestAssetPurgeInTransaction(
  trx: Transaction<Database>,
  organizationId: string,
  id: string,
): Promise<PurgeRequestResult> {
  const initial = await trx.selectFrom('assets')
    .select('projectId')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()

  if (!initial)
    return { status: 'not_found' }

  await lockProjectScopes(trx, organizationId, [initial.projectId])
  await lockActiveProjects(trx, organizationId, [initial.projectId])
  const project = initial.projectId
    ? await trx.selectFrom('projects')
        .select(['coverAssetId', 'id'])
        .where('organizationId', '=', organizationId)
        .where('id', '=', initial.projectId)
        .forUpdate()
        .executeTakeFirst()
    : null
  const asset = await trx.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst()

  if (!asset)
    return { status: 'not_found' }
  if (asset.projectId !== initial.projectId)
    return { status: 'location_changed' }

  if (asset.purgeRequestedAt) {
    if (project?.coverAssetId === id) {
      await trx.updateTable('projects')
        .set({ coverAssetId: null, updatedAt: new Date() })
        .where('organizationId', '=', organizationId)
        .where('id', '=', project.id)
        .executeTakeFirst()
    }
    return { asset, status: 'already_requested' }
  }

  const activeGeneration = await trx
    .selectFrom('generationJobInputs as input')
    .innerJoin('generationJobs as job', join => join
      .onRef('job.id', '=', 'input.jobId')
      .onRef('job.organizationId', '=', 'input.organizationId'))
    .select('input.assetId')
    .where('input.organizationId', '=', organizationId)
    .where('input.assetId', '=', id)
    .where('job.status', 'in', ['pending', 'running'])
    .executeTakeFirst()

  if (activeGeneration)
    return { status: 'active_generation' }

  const now = new Date()
  const updated = await trx.updateTable('assets')
    .set({
      deletedAt: asset.deletedAt ?? now,
      purgeRequestedAt: now,
      updatedAt: now,
    })
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()

  if (project) {
    await trx.updateTable('projects')
      .set({
        ...(project.coverAssetId === id ? { coverAssetId: null } : {}),
        updatedAt: now,
      })
      .where('organizationId', '=', organizationId)
      .where('id', '=', project.id)
      .executeTakeFirst()
  }

  // Purged Assets are tombstoned, not row-deleted, so the Element reference
  // FK cascade never fires; detach them here or they linger in Elements.
  // Lock the affected Element rows (id order) BEFORE deleting reference rows,
  // so Project content mutations share one global lock order — Project scope
  // → Project row → Asset → Element → elementReferences. The Asset is already
  // locked, so no new reference to it can appear meanwhile.
  const referencingRows = await trx.selectFrom('elementReferences')
    .select('elementId')
    .where('organizationId', '=', organizationId)
    .where('assetId', '=', id)
    .execute()
  const affectedElementIds = [...new Set(referencingRows.map(r => r.elementId))]
    .sort()

  if (affectedElementIds.length > 0) {
    await trx.selectFrom('elements')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('id', 'in', affectedElementIds)
      .orderBy('id')
      .forUpdate()
      .execute()

    await trx.deleteFrom('elementReferences')
      .where('organizationId', '=', organizationId)
      .where('assetId', '=', id)
      .execute()

    await trx.updateTable('elements')
      .set({ updatedAt: now })
      .where('organizationId', '=', organizationId)
      .where('id', 'in', affectedElementIds)
      .execute()
  }

  return { asset: updated, status: 'requested' }
}

/** Requests a purge in its own transaction. */
export async function requestAssetPurge(
  organizationId: string,
  id: string,
): Promise<PurgeRequestResult> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await db.transaction().execute(trx => (
      requestAssetPurgeInTransaction(trx, organizationId, id)
    ))
    if (result.status !== 'location_changed')
      return result
  }
  return { status: 'location_changed' }
}
