/**
 * Admission-time generated-Asset destination resolution.
 *
 * The resolver owns the single precedence rule shared by direct Create and
 * Flow admission. Callers capture its result on the run; finalizers must never
 * re-resolve mutable source or Project state.
 */

import type { Database, Transaction } from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'
import {
  availableFolderName,
  CREATE_OUTPUTS_ROOT_FOLDER_NAME,
  CREATE_OUTPUTS_ROOT_SYSTEM_ROLE,
  createSessionOutputFolderSystemRole,
  FLOW_OUTPUTS_ROOT_FOLDER_NAME,
  FLOW_OUTPUTS_ROOT_SYSTEM_ROLE,
  flowOutputFolderSystemRole,
  lockFolderStructure,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS_PER_ORGANIZATION,
  sql,
} from '@talelabs/db'

import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'

/** Immutable Project and folder attribution captured on every admitted run. */
export interface AssetDestination {
  /** Project owning generated Assets, or null for Private. */
  projectId: null | string
  /** Physical Asset folder, or null for the Project/Private root. */
  folderId: null | string
}

/** Optional per-request override whose presence distinguishes root from default. */
export interface ExplicitAssetDestination {
  /** Selected folder, or null when the Project/Private root was selected. */
  folderId: null | string
}

interface DestinationSource {
  assetFolderId: null | string
  id: string
  kind: 'create' | 'flow'
  name: null | string
  projectId: null | string
}

async function folderCount(
  trx: Transaction<Database>,
  organizationId: string,
) {
  const row = await trx.selectFrom('folders')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

async function folderDepth(
  trx: Transaction<Database>,
  organizationId: string,
  folderId: string,
) {
  const result = await sql<{ depth: number }>`
    with recursive ancestors as (
      select folder."id", folder."parentId", 1 as depth
      from "folders" folder
      where folder."organizationId" = ${organizationId}
        and folder."id" = ${folderId}
      union all
      select parent."id", parent."parentId", ancestors.depth + 1
      from "folders" parent
      join ancestors on ancestors."parentId" = parent."id"
      where parent."organizationId" = ${organizationId}
        and ancestors.depth < ${MAX_FOLDER_DEPTH + 1}
    )
    select max(depth)::integer as depth from ancestors
  `.execute(trx)
  return result.rows[0]?.depth ?? null
}

function folderLimitError() {
  return new HttpError(
    409,
    'folder_limit_reached',
    'The workspace folder limit has been reached.',
  )
}

function folderDepthError() {
  return new HttpError(
    409,
    'folder_depth_limit',
    'The generated-Asset folder would exceed the folder depth limit.',
  )
}

async function requireDestinationFolder(input: {
  folderId: string
  organizationId: string
  projectId: null | string
  trx: Transaction<Database>
}) {
  let query = input.trx.selectFrom('folders')
    .select(['id', 'projectId'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.folderId)
  query = input.projectId
    ? query.where('projectId', '=', input.projectId)
    : query.where('projectId', 'is', null)
  const folder = await query.forShare().executeTakeFirst()
  if (!folder)
    throw new TenantResourceNotFoundError('destination.folderId')
  return folder
}

async function findOrCreateManagedRoot(input: {
  kind: DestinationSource['kind']
  organizationId: string
  projectId: null | string
  trx: Transaction<Database>
}) {
  const systemRole = input.kind === 'flow'
    ? FLOW_OUTPUTS_ROOT_SYSTEM_ROLE
    : CREATE_OUTPUTS_ROOT_SYSTEM_ROLE
  const name = input.kind === 'flow'
    ? FLOW_OUTPUTS_ROOT_FOLDER_NAME
    : CREATE_OUTPUTS_ROOT_FOLDER_NAME
  let existingQuery = input.trx.selectFrom('folders')
    .select(['id', 'parentId'])
    .where('organizationId', '=', input.organizationId)
    .where('systemRole', '=', systemRole)
  existingQuery = input.projectId
    ? existingQuery.where('projectId', '=', input.projectId)
    : existingQuery.where('projectId', 'is', null)
  const existing = await existingQuery
    .forUpdate()
    .executeTakeFirst()
  if (existing) {
    if (existing.parentId) {
      throw new HttpError(
        409,
        'managed_folder_invalid',
        'The managed output folder is not available.',
      )
    }
    return existing.id
  }
  if (await folderCount(input.trx, input.organizationId)
    >= MAX_FOLDERS_PER_ORGANIZATION) {
    throw folderLimitError()
  }
  let siblingQuery = input.trx.selectFrom('folders')
    .select('name')
    .where('organizationId', '=', input.organizationId)
    .where('parentId', 'is', null)
  siblingQuery = input.projectId
    ? siblingQuery.where('projectId', '=', input.projectId)
    : siblingQuery.where('projectId', 'is', null)
  const siblings = await siblingQuery.execute()
  return input.trx.insertInto('folders')
    .values({
      id: createId(),
      name: availableFolderName(name, siblings.map(row => row.name)),
      organizationId: input.organizationId,
      parentId: null,
      projectId: input.projectId,
      systemRole,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
    .then(row => row.id)
}

async function associateManagedFolder(input: {
  folderId: string
  organizationId: string
  source: DestinationSource
  trx: Transaction<Database>
}) {
  const table = input.source.kind === 'flow' ? 'flows' : 'createSessions'
  const updated = await input.trx.updateTable(table)
    .set({ assetFolderId: input.folderId, updatedAt: new Date() })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.source.id)
    .where('assetFolderId', 'is', null)
  const scopedUpdate = input.source.projectId
    ? updated.where('projectId', '=', input.source.projectId)
    : updated.where('projectId', 'is', null)
  const result = await scopedUpdate.executeTakeFirst()
  if (Number(result.numUpdatedRows) !== 1) {
    throw new HttpError(
      409,
      'source_location_changed',
      'The source location changed during run admission.',
    )
  }
}

async function ensureManagedSourceFolder(input: {
  organizationId: string
  source: DestinationSource
  trx: Transaction<Database>
}) {
  const rootId = await findOrCreateManagedRoot({
    kind: input.source.kind,
    organizationId: input.organizationId,
    projectId: input.source.projectId,
    trx: input.trx,
  })
  const systemRole = input.source.kind === 'flow'
    ? flowOutputFolderSystemRole(input.source.id)
    : createSessionOutputFolderSystemRole(input.source.id)
  let existingQuery = input.trx.selectFrom('folders')
    .select(['id', 'parentId'])
    .where('organizationId', '=', input.organizationId)
    .where('systemRole', '=', systemRole)
  existingQuery = input.source.projectId
    ? existingQuery.where('projectId', '=', input.source.projectId)
    : existingQuery.where('projectId', 'is', null)
  const existing = await existingQuery
    .forUpdate()
    .executeTakeFirst()
  if (existing) {
    if (existing.parentId !== rootId) {
      throw new HttpError(
        409,
        'managed_folder_invalid',
        'The managed output folder is not available.',
      )
    }
    await associateManagedFolder({
      folderId: existing.id,
      organizationId: input.organizationId,
      source: input.source,
      trx: input.trx,
    })
    return existing.id
  }
  if (await folderCount(input.trx, input.organizationId)
    >= MAX_FOLDERS_PER_ORGANIZATION) {
    throw folderLimitError()
  }
  const depth = await folderDepth(input.trx, input.organizationId, rootId)
  if (depth === null || depth >= MAX_FOLDER_DEPTH)
    throw folderDepthError()
  const siblings = await input.trx.selectFrom('folders')
    .select('name')
    .where('organizationId', '=', input.organizationId)
    .where('parentId', '=', rootId)
    .execute()
  const fallback = input.source.kind === 'flow'
    ? 'Flow'
    : `Create ${input.source.id.slice(0, 8)}`
  const folder = await input.trx.insertInto('folders')
    .values({
      id: createId(),
      name: availableFolderName(
        input.source.name?.trim() || fallback,
        siblings.map(row => row.name),
      ),
      organizationId: input.organizationId,
      parentId: rootId,
      projectId: input.source.projectId,
      systemRole,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await associateManagedFolder({
    folderId: folder.id,
    organizationId: input.organizationId,
    source: input.source,
    trx: input.trx,
  })
  return folder.id
}

/**
 * Resolves the one destination captured by an admitted direct or Flow run.
 *
 * The caller must acquire Project-scope and folder-structure locks before
 * locking the supplied source row. Reacquiring the advisory folder lock here
 * documents and protects the invariant for future call sites.
 */
export async function resolveAssetDestination(input: {
  /** Present per-request override, including an explicit null root. */
  explicit?: ExplicitAssetDestination
  /** Active tenant boundary. */
  organizationId: string
  /** Source row locked against concurrent location changes. */
  source: DestinationSource
  /** Caller-owned admission transaction. */
  trx: Transaction<Database>
}): Promise<AssetDestination> {
  await lockFolderStructure(input.trx, input.organizationId)
  if (input.explicit?.folderId) {
    await requireDestinationFolder({
      folderId: input.explicit.folderId,
      organizationId: input.organizationId,
      projectId: input.source.projectId,
      trx: input.trx,
    })
  }
  if (input.source.assetFolderId) {
    await requireDestinationFolder({
      folderId: input.source.assetFolderId,
      organizationId: input.organizationId,
      projectId: input.source.projectId,
      trx: input.trx,
    })
    return {
      folderId: input.explicit
        ? input.explicit.folderId
        : input.source.assetFolderId,
      projectId: input.source.projectId,
    }
  }
  if (input.source.projectId) {
    const project = await input.trx.selectFrom('projects')
      .select(['defaultAssetFolderId', 'id'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.source.projectId)
      .where('archivedAt', 'is', null)
      .forShare()
      .executeTakeFirst()
    if (!project)
      throw new TenantResourceNotFoundError('projectId')
    if (input.explicit) {
      return {
        folderId: input.explicit.folderId,
        projectId: input.source.projectId,
      }
    }
    if (project.defaultAssetFolderId) {
      await requireDestinationFolder({
        folderId: project.defaultAssetFolderId,
        organizationId: input.organizationId,
        projectId: input.source.projectId,
        trx: input.trx,
      })
    }
    return {
      folderId: project.defaultAssetFolderId,
      projectId: input.source.projectId,
    }
  }
  if (input.explicit) {
    return {
      folderId: input.explicit.folderId,
      projectId: null,
    }
  }
  const folderId = await ensureManagedSourceFolder(input)
  return { folderId, projectId: null }
}
