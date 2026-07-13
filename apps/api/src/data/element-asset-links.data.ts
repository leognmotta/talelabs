import type {
  AssetType,
  Database,
  ElementTable,
  JsonValue,
} from '@talelabs/db'
import type {
  ElementAssetRoleDefinition,
  ElementReferenceKind,
  ElementReferenceMetadata,
} from '@talelabs/elements'
import type { Selectable, Transaction } from 'kysely'

import { db, sql } from '@talelabs/db'
import { ELEMENT_SOURCE_CAPACITY } from '@talelabs/elements'

import { getStoredElementAssetRole } from '../domain/elements/stored-element-asset-role.js'
import {
  findElementAssetRoleCapacityViolation,
  hasElementSourceCapacityViolation,
  lockElementAssetRole,
  lockElementAssetSources,
} from './element-asset-limits.data.js'
import { lockFlowReferenceBudget } from './flow-reference-budget.data.js'
import { lockFolderStructure } from './folders.data.js'

type LockedElement = Pick<
  Selectable<ElementTable>,
  'assetFolderId' | 'data' | 'id' | 'name' | 'schemaVersion' | 'type'
>

interface ElementAssetLinkIdentity {
  assetId: string
  elementId: string
  organizationId: string
  role: string
}

interface ElementAssetLinkValues {
  isPrimary: boolean
  referenceKind: ElementReferenceKind
  referenceMetadata: ElementReferenceMetadata
  sortOrder: number
}

export type ElementAssetLinkMutationFailure
  = | { status: 'asset_not_available' | 'asset_not_found' | 'element_not_found' }
    | {
      mediaType: AssetType
      status: 'incompatible_asset'
    }
    | { status: 'role_not_found' }
    | {
      maximum: number
      role: string
      status: 'element_master_role_capacity_reached'
    }
    | {
      maximum: number
      status: 'element_source_capacity_reached'
    }
    | { status: 'invalid_reference_metadata' | 'source_primary_invalid' }
    | { status: 'conflict' }

export interface PreparedElementAssetAttachment {
  element: LockedElement
  isPrimary: boolean
  referenceKind: ElementReferenceKind
  referenceMetadata: ElementReferenceMetadata
  role: ElementAssetRoleDefinition
  status: 'prepared'
}

function parseReferenceMetadata(
  role: ElementAssetRoleDefinition,
  value: unknown,
): ElementReferenceMetadata | null {
  const parsed = role.referenceMetadataSchema.safeParse(value ?? {})
  return parsed.success ? parsed.data : null
}

async function lockRoles(
  trx: Transaction<Database>,
  input: {
    elementId: string
    organizationId: string
    roles: readonly string[]
  },
) {
  const roles = [...new Set(input.roles)].sort()
  for (const role of roles) {
    await lockElementAssetRole(trx, {
      elementId: input.elementId,
      organizationId: input.organizationId,
      role,
    })
  }
}

async function findLockedElement(
  trx: Transaction<Database>,
  organizationId: string,
  elementId: string,
) {
  return trx.selectFrom('elements')
    .select([
      'assetFolderId',
      'data',
      'id',
      'name',
      'schemaVersion',
      'type',
    ])
    .where('organizationId', '=', organizationId)
    .where('id', '=', elementId)
    .forUpdate()
    .executeTakeFirst()
}

/**
 * Acquires the shared mutation hierarchy and validates an attachment before any
 * Asset or relationship row is inserted. Upload registration passes
 * `lockFolder: true`, retaining the global order:
 *
 * Flow budget -> folder structure -> Element -> role -> existing Asset.
 *
 * Fresh upload registration supplies `assetType` because its Asset row is
 * inserted later in this transaction. Every existing-Asset path locks and
 * validates the organization-owned Asset row after the Element/role locks.
 */
export async function prepareElementAssetAttachment(
  trx: Transaction<Database>,
  input: {
    assetId: string
    assetType?: AssetType
    elementId: string
    isPrimary: boolean
    lockFolder?: boolean
    organizationId: string
    referenceKind: ElementReferenceKind
    referenceMetadata: unknown
    role: string
  },
): Promise<ElementAssetLinkMutationFailure | PreparedElementAssetAttachment> {
  if (input.referenceKind === 'master')
    await lockFlowReferenceBudget(trx, input.organizationId)
  if (input.lockFolder)
    await lockFolderStructure(trx, input.organizationId)

  const element = await findLockedElement(
    trx,
    input.organizationId,
    input.elementId,
  )
  if (!element)
    return { status: 'element_not_found' }

  if (input.referenceKind === 'source') {
    await lockElementAssetSources(trx, {
      elementId: input.elementId,
      organizationId: input.organizationId,
    })
  }

  const role = getStoredElementAssetRole(element, input.role)
  if (!role)
    return { status: 'role_not_found' }

  if (input.referenceKind === 'master') {
    await lockRoles(trx, {
      elementId: input.elementId,
      organizationId: input.organizationId,
      roles: [input.role],
    })
  }

  if (input.referenceKind === 'source' && input.isPrimary)
    return { status: 'source_primary_invalid' }

  const referenceMetadata = parseReferenceMetadata(
    role,
    input.referenceMetadata,
  )
  if (!referenceMetadata)
    return { status: 'invalid_reference_metadata' }

  let assetType = input.assetType
  if (!assetType) {
    const asset = await trx.selectFrom('assets')
      .select(['deletedAt', 'id', 'purgedAt', 'purgeRequestedAt', 'type'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.assetId)
      .forUpdate()
      .executeTakeFirst()
    if (!asset)
      return { status: 'asset_not_found' }
    if (asset.deletedAt || asset.purgeRequestedAt || asset.purgedAt)
      return { status: 'asset_not_available' }
    assetType = asset.type
  }

  if (assetType === 'document' || !role.accepts.includes(assetType)) {
    return {
      mediaType: assetType,
      status: 'incompatible_asset',
    }
  }

  const duplicate = await trx.selectFrom('elementAssets')
    .select('assetId')
    .where('organizationId', '=', input.organizationId)
    .where('elementId', '=', input.elementId)
    .where('assetId', '=', input.assetId)
    .where('role', '=', input.role)
    .executeTakeFirst()
  if (duplicate)
    return { status: 'conflict' }

  if (input.referenceKind === 'master') {
    const violation = await findElementAssetRoleCapacityViolation(trx, {
      elementId: input.elementId,
      maximum: role.maxAssets,
      organizationId: input.organizationId,
      role: input.role,
    })
    if (violation) {
      return {
        ...violation,
        status: 'element_master_role_capacity_reached',
      }
    }
  }
  else if (await hasElementSourceCapacityViolation(trx, input)) {
    return {
      maximum: ELEMENT_SOURCE_CAPACITY,
      status: 'element_source_capacity_reached',
    }
  }

  return {
    element,
    isPrimary: input.isPrimary,
    referenceKind: input.referenceKind,
    referenceMetadata,
    role,
    status: 'prepared',
  }
}

async function writeGroupOrder(
  trx: Transaction<Database>,
  input: {
    elementId: string
    movingAssetId?: string
    organizationId: string
    referenceKind: ElementReferenceKind
    role: string
    targetOrder?: number
  },
) {
  const links = await trx.selectFrom('elementAssets')
    .select(['assetId', 'sortOrder'])
    .where('organizationId', '=', input.organizationId)
    .where('elementId', '=', input.elementId)
    .where('role', '=', input.role)
    .where('referenceKind', '=', input.referenceKind)
    .orderBy('sortOrder')
    .orderBy('assetId')
    .execute()
  const orderedIds = links
    .map(link => link.assetId)
    .filter(assetId => assetId !== input.movingAssetId)

  let movingOrder: number | undefined
  if (input.movingAssetId) {
    const target = Math.max(
      0,
      Math.min(input.targetOrder ?? orderedIds.length, orderedIds.length),
    )
    orderedIds.splice(target, 0, input.movingAssetId)
    movingOrder = target
  }

  for (const [sortOrder, assetId] of orderedIds.entries()) {
    await trx.updateTable('elementAssets')
      .set({ sortOrder })
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', assetId)
      .where('role', '=', input.role)
      .where('referenceKind', '=', input.referenceKind)
      .execute()
  }
  return movingOrder
}

export async function insertPreparedElementAssetAttachment(
  trx: Transaction<Database>,
  input: {
    assetId: string
    elementId: string
    organizationId: string
    prepared: PreparedElementAssetAttachment
    sortOrder?: number
    validateFlowReferenceBudgets: (
      executor: Transaction<Database>,
    ) => Promise<void>
  },
) {
  const count = await trx.selectFrom('elementAssets')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('elementId', '=', input.elementId)
    .where('role', '=', input.prepared.role.id)
    .where('referenceKind', '=', input.prepared.referenceKind)
    .executeTakeFirstOrThrow()
  const insertionOrder = Math.max(
    0,
    Math.min(input.sortOrder ?? Number(count.count), Number(count.count)),
  )

  await trx.updateTable('elementAssets')
    .set({ sortOrder: sql`"sortOrder" + 1` })
    .where('organizationId', '=', input.organizationId)
    .where('elementId', '=', input.elementId)
    .where('role', '=', input.prepared.role.id)
    .where('referenceKind', '=', input.prepared.referenceKind)
    .where('sortOrder', '>=', insertionOrder)
    .execute()

  if (input.prepared.isPrimary) {
    await trx.updateTable('elementAssets')
      .set({ isPrimary: false })
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('role', '=', input.prepared.role.id)
      .where('referenceKind', '=', 'master')
      .execute()
  }

  await trx.insertInto('elementAssets')
    .values({
      assetId: input.assetId,
      elementId: input.elementId,
      isPrimary: input.prepared.isPrimary,
      organizationId: input.organizationId,
      referenceKind: input.prepared.referenceKind,
      referenceMetadata: input.prepared.referenceMetadata as JsonValue,
      role: input.prepared.role.id,
      sortOrder: insertionOrder,
    })
    .execute()

  if (input.prepared.referenceKind === 'master')
    await input.validateFlowReferenceBudgets(trx)

  return {
    assetId: input.assetId,
    isPrimary: input.prepared.isPrimary,
    referenceKind: input.prepared.referenceKind,
    referenceMetadata: input.prepared.referenceMetadata,
    role: input.prepared.role.id,
    sortOrder: insertionOrder,
  }
}

export type CreateElementAssetLinkResult
  = ElementAssetLinkMutationFailure
    | ({ status: 'created' } & ElementAssetLinkIdentity & ElementAssetLinkValues)

export function createElementAssetLinkRow(input: {
  assetId: string
  elementId: string
  isPrimary: boolean
  organizationId: string
  referenceKind: ElementReferenceKind
  referenceMetadata: unknown
  role: string
  sortOrder?: number
  validateFlowReferenceBudgets: (
    executor: Transaction<Database>,
  ) => Promise<void>
}): Promise<CreateElementAssetLinkResult> {
  return db.transaction().execute(async (trx) => {
    const prepared = await prepareElementAssetAttachment(trx, input)
    if (prepared.status !== 'prepared')
      return prepared
    const created = await insertPreparedElementAssetAttachment(trx, {
      ...input,
      prepared,
    })
    return { ...created, elementId: input.elementId, organizationId: input.organizationId, status: 'created' }
  })
}

export type UpdateElementAssetLinkResult
  = ElementAssetLinkMutationFailure
    | { status: 'link_not_found' }
    | ({ status: 'updated' } & ElementAssetLinkIdentity & ElementAssetLinkValues)

export function updateElementAssetLinkRow(input: {
  assetId: string
  elementId: string
  isPrimary?: boolean
  organizationId: string
  referenceKind?: ElementReferenceKind
  referenceMetadata?: unknown
  role: string
  sortOrder?: number
  targetRole?: string
  validateFlowReferenceBudgets: (
    executor: Transaction<Database>,
  ) => Promise<void>
}): Promise<UpdateElementAssetLinkResult> {
  return db.transaction().execute(async (trx) => {
    // An explicit master target is the only update that may be a promotion. The
    // budget lock must be acquired before reading/locking the Element.
    if (input.referenceKind === 'master')
      await lockFlowReferenceBudget(trx, input.organizationId)

    const element = await findLockedElement(
      trx,
      input.organizationId,
      input.elementId,
    )
    if (!element)
      return { status: 'element_not_found' }

    const current = await trx.selectFrom('elementAssets')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', input.role)
      .executeTakeFirst()
    if (!current)
      return { status: 'link_not_found' }

    const referenceKind = input.referenceKind ?? current.referenceKind
    const targetRoleId = input.targetRole ?? current.role
    if (referenceKind === 'source' || current.referenceKind === 'source') {
      await lockElementAssetSources(trx, {
        elementId: input.elementId,
        organizationId: input.organizationId,
      })
    }

    const masterRoles = [
      ...(current.referenceKind === 'master' ? [current.role] : []),
      ...(referenceKind === 'master' ? [targetRoleId] : []),
    ]
    await lockRoles(trx, {
      elementId: input.elementId,
      organizationId: input.organizationId,
      roles: masterRoles,
    })

    const role = getStoredElementAssetRole(element, targetRoleId)
    if (!role)
      return { status: 'role_not_found' }

    const asset = await trx.selectFrom('assets')
      .select(['id', 'purgedAt', 'purgeRequestedAt', 'type'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.assetId)
      .forUpdate()
      .executeTakeFirst()
    if (!asset)
      return { status: 'asset_not_found' }
    if (asset.purgeRequestedAt || asset.purgedAt)
      return { status: 'asset_not_available' }
    if (asset.type === 'document' || !role.accepts.includes(asset.type)) {
      return {
        mediaType: asset.type,
        status: 'incompatible_asset',
      }
    }

    const referenceMetadata = parseReferenceMetadata(
      role,
      input.referenceMetadata ?? current.referenceMetadata,
    )
    if (!referenceMetadata)
      return { status: 'invalid_reference_metadata' }

    if (referenceKind === 'source' && input.isPrimary === true)
      return { status: 'source_primary_invalid' }
    const isPrimary = referenceKind === 'source'
      ? false
      : input.isPrimary ?? (
        current.referenceKind === 'master' ? current.isPrimary : false
      )

    if (targetRoleId !== current.role) {
      const duplicate = await trx.selectFrom('elementAssets')
        .select('assetId')
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('assetId', '=', input.assetId)
        .where('role', '=', targetRoleId)
        .executeTakeFirst()
      if (duplicate)
        return { status: 'conflict' }
    }

    const increasesMasterRole = referenceKind === 'master' && (
      current.referenceKind === 'source' || targetRoleId !== current.role
    )
    if (increasesMasterRole) {
      const violation = await findElementAssetRoleCapacityViolation(trx, {
        elementId: input.elementId,
        maximum: role.maxAssets,
        organizationId: input.organizationId,
        role: targetRoleId,
      })
      if (violation) {
        return {
          ...violation,
          status: 'element_master_role_capacity_reached',
        }
      }
    }

    const increasesSources = current.referenceKind === 'master'
      && referenceKind === 'source'
    if (increasesSources && await hasElementSourceCapacityViolation(trx, input)) {
      return {
        maximum: ELEMENT_SOURCE_CAPACITY,
        status: 'element_source_capacity_reached',
      }
    }

    const changesGroup = current.role !== targetRoleId
      || current.referenceKind !== referenceKind
    if (changesGroup) {
      await trx.updateTable('elementAssets')
        .set({
          isPrimary: false,
          referenceKind,
          referenceMetadata: referenceMetadata as JsonValue,
          role: targetRoleId,
          sortOrder: -1,
        })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('assetId', '=', input.assetId)
        .where('role', '=', current.role)
        .executeTakeFirstOrThrow()
      await writeGroupOrder(trx, {
        elementId: input.elementId,
        organizationId: input.organizationId,
        referenceKind: current.referenceKind,
        role: current.role,
      })
    }
    else {
      await trx.updateTable('elementAssets')
        .set({
          referenceMetadata: referenceMetadata as JsonValue,
        })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('assetId', '=', input.assetId)
        .where('role', '=', current.role)
        .executeTakeFirstOrThrow()
    }

    const targetOrder = await writeGroupOrder(trx, {
      elementId: input.elementId,
      movingAssetId: input.assetId,
      organizationId: input.organizationId,
      referenceKind,
      role: targetRoleId,
      targetOrder: input.sortOrder ?? (changesGroup ? undefined : current.sortOrder),
    })

    if (isPrimary) {
      await trx.updateTable('elementAssets')
        .set({ isPrimary: false })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('role', '=', targetRoleId)
        .where('referenceKind', '=', 'master')
        .execute()
    }
    await trx.updateTable('elementAssets')
      .set({ isPrimary, sortOrder: targetOrder ?? 0 })
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', targetRoleId)
      .executeTakeFirstOrThrow()

    if (current.referenceKind === 'source' && referenceKind === 'master')
      await input.validateFlowReferenceBudgets(trx)

    return {
      assetId: input.assetId,
      elementId: input.elementId,
      isPrimary,
      organizationId: input.organizationId,
      referenceKind,
      referenceMetadata,
      role: targetRoleId,
      sortOrder: targetOrder ?? 0,
      status: 'updated',
    }
  })
}

export function deleteElementAssetLinkRow(input: ElementAssetLinkIdentity) {
  return db.transaction().execute(async (trx) => {
    const element = await findLockedElement(
      trx,
      input.organizationId,
      input.elementId,
    )
    if (!element)
      return false

    const current = await trx.selectFrom('elementAssets')
      .select(['assetId', 'referenceKind', 'role'])
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', input.role)
      .executeTakeFirst()
    if (!current)
      return false

    if (current.referenceKind === 'source') {
      await lockElementAssetSources(trx, {
        elementId: input.elementId,
        organizationId: input.organizationId,
      })
    }
    else {
      await lockRoles(trx, {
        elementId: input.elementId,
        organizationId: input.organizationId,
        roles: [current.role],
      })
    }

    await trx.deleteFrom('elementAssets')
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', current.role)
      .executeTakeFirstOrThrow()
    await writeGroupOrder(trx, {
      elementId: input.elementId,
      organizationId: input.organizationId,
      referenceKind: current.referenceKind,
      role: current.role,
    })
    return true
  })
}
