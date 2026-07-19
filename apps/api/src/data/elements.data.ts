/**
 * Kysely data access for Elements and their ordered reference Assets.
 *
 * An Element is a named collection of reference image Assets. Every write
 * that touches references runs inside one transaction with the Element row
 * locked, so no link-level choreography or partial-update states exist.
 */

import type { AssetTable, Database, ElementTable } from '@talelabs/db'
import type { Selectable, Transaction } from 'kysely'
import type { PageCursor, SortOrder } from '../pagination/cursor.js'

import { MAX_ELEMENT_REFERENCES } from '@talelabs/assets'
import { db, sql } from '@talelabs/db'

/** One persisted Element row. */
export type ElementRecord = Selectable<ElementTable>

/** One Element list row with its derived reference count. */
export type ElementListRow = ElementRecord & { referenceCount: number }

/** Filters, cursor, and page size for the Element list query. */
export interface ListElementRowsInput {
  assetId?: string
  cursor: PageCursor<'updatedAt'> | null
  kind?: string
  limit: number
  order: SortOrder
  organizationId: string
  search?: string
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

/** Lists Element rows with derived reference counts, `limit + 1` for paging. */
export async function listElementRows(input: ListElementRowsInput) {
  const conditions = [
    sql<boolean>`element."organizationId" = ${input.organizationId}`,
  ]

  if (input.kind)
    conditions.push(sql<boolean>`element."kind" = ${input.kind}`)

  if (input.search) {
    const pattern = `%${escapeLike(input.search)}%`
    conditions.push(sql<boolean>`element."name" ilike ${pattern} escape '\\'`)
  }

  if (input.assetId) {
    conditions.push(sql<boolean>`exists (
      select 1 from "elementReferences" reference
      where reference."organizationId" = ${input.organizationId}
        and reference."elementId" = element."id"
        and reference."assetId" = ${input.assetId}
    )`)
  }

  if (input.cursor) {
    const direction = input.cursor.order === 'asc' ? sql`>` : sql`<`
    const value = new Date(String(input.cursor.sortValue))
    conditions.push(sql<boolean>`(
      element."updatedAt" ${direction} ${value}
      or (element."updatedAt" = ${value} and element."id" ${direction} ${input.cursor.id})
    )`)
  }

  const direction = sql.raw(input.order)
  const result = await sql<ElementListRow>`
    select
      element.*,
      (
        select count(*)::integer from "elementReferences" reference
        where reference."organizationId" = ${input.organizationId}
          and reference."elementId" = element."id"
      ) as "referenceCount"
    from "elements" element
    where ${sql.join(conditions, sql` and `)}
    order by element."updatedAt" ${direction}, element."id" ${direction}
    limit ${input.limit + 1}
  `.execute(db)

  return result.rows
}

/** Loads one tenant-scoped Element row, or undefined. */
export function findElementRow(organizationId: string, id: string) {
  return db.selectFrom('elements')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

/** Reference validation failure naming the offending Assets. */
export type InvalidReferenceResult
  = | { invalidAssetIds: string[], status: 'asset_not_available' }
    | { invalidAssetIds: string[], status: 'not_image' }

/** Locked lifecycle facts for one candidate reference Asset. */
interface LockedReferenceAsset { purgeRequestedAt: Date | null, type: string }

/**
 * Every Element write that also touches Asset rows locks the candidate Assets
 * here first — sorted by id, before the Element row — so all paths (create,
 * update, reference mutation, and Asset purge) acquire the two lock classes in
 * one global order (Assets → Element) and can never deadlock against purge.
 */
async function lockReferenceAssets(
  trx: Transaction<Database>,
  organizationId: string,
  assetIds: readonly string[],
): Promise<Map<string, LockedReferenceAsset>> {
  if (assetIds.length === 0)
    return new Map()

  const assets = await trx.selectFrom('assets')
    .select(['id', 'type', 'purgeRequestedAt'])
    .where('organizationId', '=', organizationId)
    .where('id', 'in', [...new Set(assetIds)])
    .orderBy('id')
    .forUpdate()
    .execute()
  return new Map(assets.map(asset => [asset.id, asset]))
}

/**
 * Reports the first validation failure among `assetIds` using already-locked
 * rows: Assets must be tenant-owned images that are not being purged; archived
 * Assets stay attachable so history never silently disappears.
 */
function validateReferenceAssets(
  assetsById: Map<string, LockedReferenceAsset>,
  assetIds: readonly string[],
): InvalidReferenceResult | null {
  const missing = assetIds.filter((id) => {
    const asset = assetsById.get(id)
    return !asset || asset.purgeRequestedAt !== null
  })
  if (missing.length > 0)
    return { invalidAssetIds: missing, status: 'asset_not_available' }

  const nonImage = assetIds.filter(id => assetsById.get(id)!.type !== 'image')
  if (nonImage.length > 0)
    return { invalidAssetIds: nonImage, status: 'not_image' }

  return null
}

/** Rewrites one Element's reference rows to `assetIds` in dense sort order. */
async function writeReferenceRows(
  trx: Transaction<Database>,
  organizationId: string,
  elementId: string,
  assetIds: readonly string[],
) {
  await trx.deleteFrom('elementReferences')
    .where('organizationId', '=', organizationId)
    .where('elementId', '=', elementId)
    .execute()

  if (assetIds.length > 0) {
    await trx.insertInto('elementReferences')
      .values(assetIds.map((assetId, index) => ({
        assetId,
        elementId,
        organizationId,
        sortOrder: index,
      })))
      .execute()
  }
}

/** Outcome of the transactional Element create. */
export type CreateElementRowResult
  = | InvalidReferenceResult
    | { element: ElementRecord, status: 'created' }

/** Creates the Element row and its reference rows in one transaction. */
export async function insertElementRowWithReferences(input: {
  assetIds: readonly string[]
  createdBy: string
  description: string
  id: string
  kind: string
  name: string
  organizationId: string
}): Promise<CreateElementRowResult> {
  return db.transaction().execute(async (trx) => {
    // Assets first (the new Element row is not yet visible to lock).
    const lockedAssets = await lockReferenceAssets(
      trx,
      input.organizationId,
      input.assetIds,
    )
    const invalid = validateReferenceAssets(lockedAssets, input.assetIds)
    if (invalid)
      return invalid

    const element = await trx.insertInto('elements')
      .values({
        createdBy: input.createdBy,
        description: input.description,
        id: input.id,
        kind: input.kind,
        name: input.name,
        organizationId: input.organizationId,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await writeReferenceRows(
      trx,
      input.organizationId,
      element.id,
      input.assetIds,
    )
    return { element, status: 'created' as const }
  })
}

/** Outcome of the transactional Element update. */
export type UpdateElementRowResult
  = | InvalidReferenceResult
    | { element: ElementRecord, status: 'updated' }
    | { status: 'element_not_found' }

/**
 * Updates Element metadata and, when `assetIds` is provided, replaces the
 * complete ordered reference list — all in one transaction with the Element
 * row locked, so a failed save never leaves a half-applied Element.
 */
export async function updateElementRowWithReferences(input: {
  assetIds?: readonly string[]
  description?: string
  id: string
  kind?: string
  name?: string
  organizationId: string
}): Promise<UpdateElementRowResult> {
  return db.transaction().execute(async (trx) => {
    // Lock candidate Assets before the Element row (Assets → Element order).
    const lockedAssets = input.assetIds === undefined
      ? new Map()
      : await lockReferenceAssets(trx, input.organizationId, input.assetIds)

    const element = await trx.selectFrom('elements')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()

    if (!element)
      return { status: 'element_not_found' as const }

    if (input.assetIds !== undefined) {
      const invalid = validateReferenceAssets(lockedAssets, input.assetIds)
      if (invalid)
        return invalid

      await writeReferenceRows(
        trx,
        input.organizationId,
        input.id,
        input.assetIds,
      )
    }

    const updated = await trx.updateTable('elements')
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return { element: updated, status: 'updated' as const }
  })
}

/** Deletes one Element row; reference rows cascade, Assets are untouched. */
export function deleteElementRow(organizationId: string, id: string) {
  return db.deleteFrom('elements')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst()
}

/** One reference row joined with its canonical Asset. */
export type ElementReferenceAssetRow = Selectable<AssetTable> & {
  referenceSortOrder: number
}

/** Lists one Element's reference Assets in stored order. */
export async function listElementReferenceAssetRows(
  organizationId: string,
  elementId: string,
): Promise<ElementReferenceAssetRow[]> {
  return db.selectFrom('elementReferences as reference')
    .innerJoin('assets as asset', join => join
      .onRef('asset.id', '=', 'reference.assetId')
      .onRef('asset.organizationId', '=', 'reference.organizationId'))
    .selectAll('asset')
    .select('reference.sortOrder as referenceSortOrder')
    .where('reference.organizationId', '=', organizationId)
    .where('reference.elementId', '=', elementId)
    .orderBy('reference.sortOrder')
    .orderBy('reference.assetId')
    .execute()
}

/** One Element's cover Asset (its first-ordered reference), with the owner. */
export type ElementCoverAssetRow = Selectable<AssetTable> & {
  elementId: string
}

/** Loads the cover Asset for each given Element in one query. */
export async function listElementCoverAssetRows(
  organizationId: string,
  elementIds: readonly string[],
): Promise<ElementCoverAssetRow[]> {
  if (elementIds.length === 0)
    return []

  const result = await sql<ElementCoverAssetRow>`
    select distinct on (reference."elementId")
      asset.*,
      reference."elementId" as "elementId"
    from "elementReferences" reference
    inner join "assets" asset
      on asset."id" = reference."assetId"
      and asset."organizationId" = reference."organizationId"
    where reference."organizationId" = ${organizationId}
      and reference."elementId" in (${sql.join([...elementIds])})
    order by reference."elementId", reference."sortOrder", reference."assetId"
  `.execute(db)

  return result.rows
}

/** Ordered reference Asset IDs for a set of Elements, keyed by Element ID. */
export async function listElementReferenceIdsByElement(
  executor: Pick<Transaction<Database>, 'selectFrom'> | typeof db,
  organizationId: string,
  elementIds: readonly string[],
) {
  if (elementIds.length === 0)
    return {} as Record<string, string[]>

  const rows = await executor.selectFrom('elementReferences')
    .select(['elementId', 'assetId'])
    .where('organizationId', '=', organizationId)
    .where('elementId', 'in', [...elementIds])
    .orderBy('sortOrder')
    .orderBy('assetId')
    .execute()

  const byElement: Record<string, string[]> = {}
  for (const row of rows) {
    byElement[row.elementId] ??= []
    byElement[row.elementId]!.push(row.assetId)
  }
  return byElement
}

/** Elements resolvable for graph hydration, keyed lookups included. */
export async function listElementRowsByIds(
  executor: Pick<Transaction<Database>, 'selectFrom'> | typeof db,
  organizationId: string,
  elementIds: readonly string[],
) {
  if (elementIds.length === 0)
    return []
  return executor.selectFrom('elements')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', 'in', [...elementIds])
    .execute()
}

/** Outcome of the atomic reference add/remove. */
export type MutateElementReferenceRowsResult
  = | InvalidReferenceResult
    | {
      addedAssetIds: string[]
      element: ElementRecord
      removedAssetIds: string[]
      status: 'mutated'
    }
    | { status: 'element_not_found' }

/**
 * Atomically appends and/or removes references against the Element's current
 * server-side list, so concurrent capture flows never overwrite each other
 * with stale full lists. Additions already present are skipped, additions
 * beyond capacity are dropped in request order, and removals of absent
 * Assets are no-ops. An Asset named in both `add` and `remove` cancels out —
 * it is neither added nor removed regardless of current membership (the API
 * schema also rejects such overlap upfront). `addedAssetIds`/`removedAssetIds`
 * are the real before→after transition.
 */
export async function mutateElementReferenceRows(input: {
  addAssetIds: readonly string[]
  elementId: string
  organizationId: string
  removeAssetIds: readonly string[]
}): Promise<MutateElementReferenceRowsResult> {
  return db.transaction().execute(async (trx) => {
    // Lock the add candidates (Assets → Element order) before the Element row.
    const lockedAssets = await lockReferenceAssets(
      trx,
      input.organizationId,
      input.addAssetIds,
    )

    const element = await trx.selectFrom('elements')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.elementId)
      .forUpdate()
      .executeTakeFirst()

    if (!element)
      return { status: 'element_not_found' as const }

    const currentRows = await trx.selectFrom('elementReferences')
      .select('assetId')
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .orderBy('sortOrder')
      .orderBy('assetId')
      .execute()
    const current = currentRows.map(row => row.assetId)

    // An Asset in both lists cancels out: drop it from both effective sets so
    // the operation is a true no-op for it, whatever the current membership.
    const addDeduped = [...new Set(input.addAssetIds)]
    const removeSetRaw = new Set(input.removeAssetIds)
    const overlap = new Set(addDeduped.filter(id => removeSetRaw.has(id)))
    const removeSet = new Set(
      [...removeSetRaw].filter(id => !overlap.has(id)),
    )
    const kept = current.filter(id => !removeSet.has(id))
    const keptSet = new Set(kept)
    const candidates = addDeduped
      .filter(id => !overlap.has(id) && !keptSet.has(id))
    const capacity = Math.max(0, MAX_ELEMENT_REFERENCES - kept.length)
    const accepted = candidates.slice(0, capacity)

    const invalid = validateReferenceAssets(lockedAssets, accepted)
    if (invalid)
      return invalid

    const final = [...kept, ...accepted]
    const beforeSet = new Set(current)
    const finalSet = new Set(final)
    const addedAssetIds = final.filter(id => !beforeSet.has(id))
    const removedAssetIds = current.filter(id => !finalSet.has(id))

    if (addedAssetIds.length > 0 || removedAssetIds.length > 0)
      await writeReferenceRows(trx, input.organizationId, input.elementId, final)

    const updated = await trx.updateTable('elements')
      .set({ updatedAt: new Date() })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.elementId)
      .returningAll()
      .executeTakeFirstOrThrow()

    return {
      addedAssetIds,
      element: updated,
      removedAssetIds,
      status: 'mutated' as const,
    }
  })
}
