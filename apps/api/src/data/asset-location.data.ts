/** Transactional Asset registration, naming, and Project/folder moves. */

import type { AssetTable, AssetType, Database } from '@talelabs/db'
import type { Kysely, Selectable, Transaction } from 'kysely'

import { BILLING_CATALOG, getBillingPlan } from '@talelabs/billing'
import {
  claimUploadedAssetStorage,
  commitAssetUploadIntentRegistration,
  db,
  ensureOrganizationBillingState,
  lockAssetUploadIntentForRegistration,
  lockFolderStructure,
  reconcileExpiredPaidEntitlement,
} from '@talelabs/db'

import {
  lockActiveProject,
  lockActiveProjects,
  lockProjectScopes,
  touchProject,
} from '../domain/projects/project-scope.js'

/** One Asset row returned after a location mutation. */
export type LocatedAssetRecord = Selectable<AssetTable>

/** Loads one tenant-scoped folder with its exact Project scope. */
export function findFolderLocation(organizationId: string, id: string) {
  return db.selectFrom('folders')
    .select(['id', 'projectId'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

async function findFolderLocationInTransaction(
  trx: Transaction<Database>,
  organizationId: string,
  id: string,
) {
  return trx.selectFrom('folders')
    .select(['id', 'projectId'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .forShare()
    .executeTakeFirst()
}

/** Registers one uploaded Asset in an atomically validated location. */
export async function insertUploadedAsset(input: {
  checksumMd5: string
  createdBy: string
  expiresAt: Date
  folderId: null | string
  grantFilename: string
  grantVersion: 1 | 2
  id: string
  mimeType: string
  name: string
  organizationId: string
  projectId: null | string
  sizeBytes: number
  storageKey: string
  type: AssetType
  uploadId: string
}, database: Kysely<Database> = db) {
  return database.transaction().execute(async (trx) => {
    await lockProjectScopes(trx, input.organizationId, [input.projectId])
    await lockActiveProject(trx, input.organizationId, input.projectId)
    if (input.folderId) {
      await lockFolderStructure(trx, input.organizationId)
      const folder = await findFolderLocationInTransaction(
        trx,
        input.organizationId,
        input.folderId,
      )
      if (!folder || folder.projectId !== input.projectId)
        return { field: 'folderId' as const, status: 'not_found' as const }
    }
    if (input.grantVersion === 2) {
      const intent = await lockAssetUploadIntentForRegistration({
        checksumMd5: input.checksumMd5,
        expiresAt: input.expiresAt,
        filename: input.grantFilename,
        id: input.uploadId,
        mimeType: input.mimeType,
        objectKey: input.storageKey,
        organizationId: input.organizationId,
        sizeBytes: input.sizeBytes,
        userId: input.createdBy,
      }, trx)
      if (intent.status === 'invalid')
        return { status: 'invalid_upload' as const }
      if (intent.status === 'registered') {
        const asset = await trx.selectFrom('assets')
          .selectAll()
          .where('organizationId', '=', input.organizationId)
          .where('id', '=', intent.assetId)
          .executeTakeFirstOrThrow()
        return { asset, status: 'replayed' as const }
      }
    }
    else {
      await ensureOrganizationBillingState({
        catalogRevision: BILLING_CATALOG.revision,
        organizationId: input.organizationId,
      }, trx)
      await reconcileExpiredPaidEntitlement(input.organizationId, trx)
      const billingAccount = await trx.selectFrom('organizationBillingAccounts')
        .select('currentPlanCode')
        .where('organizationId', '=', input.organizationId)
        .executeTakeFirstOrThrow()
      await claimUploadedAssetStorage({
        catalogRevision: BILLING_CATALOG.revision,
        organizationId: input.organizationId,
        sizeBytes: input.sizeBytes,
        storageLimitBytes:
          getBillingPlan(billingAccount.currentPlanCode).storageBytes,
      }, trx)
    }
    const asset = await trx.insertInto('assets')
      .values({
        createdBy: input.createdBy,
        folderId: input.folderId,
        id: input.id,
        mimeType: input.mimeType,
        name: input.name,
        organizationId: input.organizationId,
        processingState: 'processing',
        projectId: input.projectId,
        source: 'upload',
        storageKey: input.storageKey,
        type: input.type,
        uploadId: input.uploadId,
        visibility: 'private',
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    if (input.grantVersion === 2) {
      await commitAssetUploadIntentRegistration({
        assetId: asset.id,
        id: input.uploadId,
        organizationId: input.organizationId,
      }, trx)
    }
    await touchProject(trx, input.organizationId, input.projectId)
    return { asset, status: 'created' as const }
  })
}

/** Outcome of an individual Asset metadata/location update. */
export type UpdateAssetRowResult
  = | { asset: LocatedAssetRecord, status: 'updated' }
    | { field?: 'folderId' | 'projectId', status: 'not_found' }
    | { status: 'invalid_state' }

/** Updates one Asset name and optional Project/folder location atomically. */
export async function updateAssetRow(input: {
  folderId?: null | string
  id: string
  name?: string
  organizationId: string
  projectId?: null | string
}): Promise<UpdateAssetRowResult> {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('assets')
      .select(['folderId', 'projectId'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .executeTakeFirst()
    if (!initial)
      return { status: 'not_found' as const }

    const locationMutation = input.folderId !== undefined
      || input.projectId !== undefined
    let targetFolderId = input.folderId !== undefined
      ? input.folderId
      : initial.folderId
    let targetProjectId = input.projectId !== undefined
      ? input.projectId
      : initial.projectId
    if (
      input.projectId !== undefined
      && input.folderId === undefined
      && input.projectId !== initial.projectId
    ) {
      targetFolderId = null
    }
    if (locationMutation && targetFolderId) {
      const folder = await trx.selectFrom('folders')
        .select('projectId')
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', targetFolderId)
        .executeTakeFirst()
      if (!folder)
        return { field: 'folderId', status: 'not_found' as const }
      if (
        input.projectId !== undefined
        && input.projectId !== folder.projectId
      ) {
        return { field: 'folderId', status: 'not_found' as const }
      }
      targetProjectId = folder.projectId
    }
    await lockProjectScopes(
      trx,
      input.organizationId,
      [initial.projectId, targetProjectId],
    )
    await lockActiveProjects(
      trx,
      input.organizationId,
      [initial.projectId, targetProjectId],
    )
    if (locationMutation)
      await lockFolderStructure(trx, input.organizationId)

    if (locationMutation && targetFolderId) {
      const folder = await findFolderLocationInTransaction(
        trx,
        input.organizationId,
        targetFolderId,
      )
      if (!folder || folder.projectId !== targetProjectId)
        return { field: 'folderId', status: 'not_found' as const }
    }

    const current = await trx.selectFrom('assets')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (!current)
      return { status: 'not_found' as const }
    if (
      current.folderId !== initial.folderId
      || current.projectId !== initial.projectId
    ) {
      return { status: 'invalid_state' as const }
    }
    if (current.purgeRequestedAt || current.purgedAt)
      return { status: 'invalid_state' as const }

    if (targetProjectId !== current.projectId) {
      await trx.updateTable('projects')
        .set({ coverAssetId: null, updatedAt: new Date() })
        .where('organizationId', '=', input.organizationId)
        .where('coverAssetId', '=', current.id)
        .execute()
    }
    const asset = await trx.updateTable('assets')
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        folderId: targetFolderId,
        projectId: targetProjectId,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .where('purgeRequestedAt', 'is', null)
      .returningAll()
      .executeTakeFirst()
    if (!asset)
      return { status: 'invalid_state' as const }
    await Promise.all([
      touchProject(trx, input.organizationId, current.projectId),
      touchProject(trx, input.organizationId, targetProjectId),
    ])
    return { asset, status: 'updated' as const }
  })
}

/** Outcome of one bounded Asset batch location move. */
export type MoveAssetRowsResult
  = | { assets: LocatedAssetRecord[], status: 'moved' }
    | { field?: 'assetIds' | 'folderId' | 'projectId', status: 'not_found' }
    | { status: 'invalid_state' }

/** Moves Assets into one exact Project/folder destination transactionally. */
export function moveAssetRows(input: {
  assetIds: string[]
  folderId: null | string
  organizationId: string
  projectId?: null | string
}): Promise<MoveAssetRowsResult> {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('assets')
      .select(['id', 'projectId'])
      .where('organizationId', '=', input.organizationId)
      .where('id', 'in', input.assetIds)
      .execute()
    if (initial.length !== input.assetIds.length)
      return { field: 'assetIds', status: 'not_found' as const }

    let targetProjectId = input.projectId
    if (input.folderId) {
      const folder = await trx.selectFrom('folders')
        .select('projectId')
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.folderId)
        .executeTakeFirst()
      if (!folder)
        return { field: 'folderId', status: 'not_found' as const }
      if (
        input.projectId !== undefined
        && input.projectId !== folder.projectId
      ) {
        return { field: 'folderId', status: 'not_found' as const }
      }
      targetProjectId = folder.projectId
    }
    const currentScopes = initial.map(asset => asset.projectId)
    await lockProjectScopes(
      trx,
      input.organizationId,
      [...currentScopes, ...(targetProjectId !== undefined
        ? [targetProjectId]
        : [])],
    )
    await lockActiveProjects(
      trx,
      input.organizationId,
      [
        ...currentScopes,
        ...(targetProjectId !== undefined ? [targetProjectId] : []),
      ],
    )
    await lockFolderStructure(trx, input.organizationId)
    if (input.folderId) {
      const folder = await findFolderLocationInTransaction(
        trx,
        input.organizationId,
        input.folderId,
      )
      if (!folder || folder.projectId !== targetProjectId)
        return { field: 'folderId', status: 'not_found' as const }
    }
    const assets = await trx.selectFrom('assets')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', 'in', input.assetIds)
      .orderBy('id')
      .forUpdate()
      .execute()
    if (assets.length !== input.assetIds.length)
      return { field: 'assetIds', status: 'not_found' as const }
    const initialScopesById = new Map(
      initial.map(asset => [asset.id, asset.projectId]),
    )
    if (assets.some(asset => (
      asset.projectId !== initialScopesById.get(asset.id)
    ))) {
      return { status: 'invalid_state' as const }
    }
    if (assets.some(asset => asset.purgeRequestedAt || asset.purgedAt))
      return { status: 'invalid_state' as const }

    if (targetProjectId !== undefined) {
      const movingAssetIds = assets
        .filter(asset => asset.projectId !== targetProjectId)
        .map(asset => asset.id)
      if (movingAssetIds.length) {
        await trx.updateTable('projects')
          .set({ coverAssetId: null, updatedAt: new Date() })
          .where('organizationId', '=', input.organizationId)
          .where('coverAssetId', 'in', movingAssetIds)
          .execute()
      }
    }
    const updated = await trx.updateTable('assets')
      .set({
        folderId: input.folderId,
        ...(targetProjectId !== undefined
          ? { projectId: targetProjectId }
          : {}),
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', 'in', input.assetIds)
      .where('purgeRequestedAt', 'is', null)
      .returningAll()
      .execute()
    if (updated.length !== input.assetIds.length)
      return { status: 'invalid_state' as const }
    for (const projectId of new Set([
      ...currentScopes,
      ...(targetProjectId !== undefined ? [targetProjectId] : []),
    ])) {
      await touchProject(trx, input.organizationId, projectId)
    }
    const byId = new Map(updated.map(asset => [asset.id, asset]))
    return {
      assets: input.assetIds.map(id => byId.get(id)!),
      status: 'moved',
    }
  })
}
