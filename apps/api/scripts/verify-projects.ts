/**
 * Disposable-database verification for Project moves and Asset destinations.
 *
 * The target database name must identify an isolated Projects verifier. This
 * script intentionally refuses ordinary application databases.
 */

import { setTimeout as delay } from 'node:timers/promises'

import {
  db,
  destroyDb,
  lockFolderStructure,
  MAX_FOLDER_DEPTH,
} from '@talelabs/db'

import { moveAssetRows } from '../src/data/asset-location.data.js'
import {
  createFolderRow,
  updateFolderRow,
} from '../src/data/folders.data.js'
import {
  resolveAssetDestination,
} from '../src/domain/projects/asset-destination.js'
import {
  lockActiveProject,
  lockProjectScopes,
} from '../src/domain/projects/project-scope.js'
import { createFolder } from '../src/services/folders.service.js'
import {
  verifyCapturedFinalizationParity,
} from './projects-verifier-finalization.js'

const connectionString = process.env.POSTGRES_URL
if (!connectionString)
  throw new Error('POSTGRES_URL is required')
const databaseName = new URL(connectionString).pathname.slice(1)
if (!databaseName.startsWith('talelabs_projects_runtime_'))
  throw new Error('projects_verifier_requires_disposable_database')

const suffix = `${process.pid}-${Date.now()}`
const organizationA = `projects-runtime-org-a-${suffix}`
const organizationB = `projects-runtime-org-b-${suffix}`
const projectA = `projects-runtime-a-${suffix}`
const projectB = `projects-runtime-b-${suffix}`
const otherTenantProject = `projects-runtime-other-${suffix}`

function assert(condition: unknown, label: string): asserts condition {
  if (!condition)
    throw new Error(`projects_verification_failed:${label}`)
}

async function expectRejected(
  operation: () => Promise<unknown>,
  label: string,
) {
  let rejected = false
  try {
    await operation()
  }
  catch {
    rejected = true
  }
  assert(rejected, label)
}

async function seedScopes() {
  const now = new Date()
  await db.insertInto('organization')
    .values([
      {
        createdAt: now,
        id: organizationA,
        logo: null,
        metadata: null,
        name: 'Projects runtime A',
        slug: `projects-runtime-a-${suffix}`,
      },
      {
        createdAt: now,
        id: organizationB,
        logo: null,
        metadata: null,
        name: 'Projects runtime B',
        slug: `projects-runtime-b-${suffix}`,
      },
    ])
    .execute()
  await db.insertInto('projects')
    .values([
      {
        createdBy: null,
        description: '',
        id: projectA,
        name: 'Runtime A',
        organizationId: organizationA,
      },
      {
        createdBy: null,
        description: '',
        id: projectB,
        name: 'Runtime B',
        organizationId: organizationA,
      },
      {
        createdBy: null,
        description: '',
        id: otherTenantProject,
        name: 'Other tenant',
        organizationId: organizationB,
      },
    ])
    .execute()
}

async function addFolder(input: {
  id: string
  organizationId?: string
  parentId?: null | string
  projectId?: null | string
}) {
  return createFolderRow({
    id: input.id,
    name: input.id,
    organizationId: input.organizationId ?? organizationA,
    parentId: input.parentId ?? null,
    projectId: input.projectId,
  })
}

async function verifyFolderInvariants() {
  const serviceFolder = await createFolder({
    name: 'Service Project folder',
    organizationId: organizationA,
    projectId: projectA,
  })
  assert(serviceFolder.projectId === projectA, 'service_forwards_project_scope')

  const cycleRoot = `cycle-root-${suffix}`
  const cycleChild = `cycle-child-${suffix}`
  assert(
    (await addFolder({ id: cycleRoot, projectId: projectA })).status
    === 'created',
    'cycle_root_created',
  )
  assert(
    (await addFolder({
      id: cycleChild,
      parentId: cycleRoot,
      projectId: projectA,
    })).status === 'created',
    'cycle_child_created',
  )
  assert(
    (await updateFolderRow({
      id: cycleRoot,
      organizationId: organizationA,
      parentId: cycleChild,
    })).status === 'cycle',
    'cycle_rejected',
  )

  let parentId: null | string = null
  for (let depth = 1; depth <= MAX_FOLDER_DEPTH; depth += 1) {
    const id = `depth-${depth}-${suffix}`
    const result = await addFolder({
      id,
      parentId,
      projectId: projectA,
    })
    assert(result.status === 'created', `depth_${depth}_created`)
    parentId = id
  }
  assert(
    (await addFolder({
      id: `depth-overflow-${suffix}`,
      parentId,
      projectId: projectA,
    })).status === 'depth',
    'depth_overflow_rejected',
  )

  const projectBRoot = `project-b-root-${suffix}`
  const otherTenantRoot = `other-tenant-root-${suffix}`
  assert(
    (await addFolder({ id: projectBRoot, projectId: projectB })).status
    === 'created',
    'project_b_root_created',
  )
  assert(
    (await addFolder({
      id: otherTenantRoot,
      organizationId: organizationB,
      projectId: otherTenantProject,
    })).status === 'created',
    'other_tenant_root_created',
  )
  assert(
    (await addFolder({
      id: `cross-project-child-${suffix}`,
      parentId: projectBRoot,
      projectId: projectA,
    })).status === 'parent_not_found',
    'cross_project_parent_rejected',
  )
  assert(
    (await addFolder({
      id: `cross-tenant-child-${suffix}`,
      parentId: otherTenantRoot,
      projectId: projectA,
    })).status === 'parent_not_found',
    'cross_tenant_parent_rejected',
  )
  await expectRejected(
    () => addFolder({
      id: `cross-tenant-project-${suffix}`,
      projectId: otherTenantProject,
    }),
    'cross_tenant_project_rejected',
  )

  const moveRoot = `move-root-${suffix}`
  const moveChild = `move-child-${suffix}`
  const moveAssetId = `move-asset-${suffix}`
  assert(
    (await addFolder({ id: moveRoot, projectId: projectA })).status
    === 'created',
    'move_root_created',
  )
  assert(
    (await addFolder({
      id: moveChild,
      parentId: moveRoot,
      projectId: projectA,
    })).status === 'created',
    'move_child_created',
  )
  await db.insertInto('assets').values({
    createdBy: null,
    folderId: moveChild,
    id: moveAssetId,
    mimeType: 'image/png',
    name: 'Move Asset',
    organizationId: organizationA,
    processingState: 'ready',
    projectId: projectA,
    source: 'upload',
    storageKey: `projects-runtime/${moveAssetId}`,
    type: 'image',
    uploadId: `upload-${moveAssetId}`,
    visibility: 'private',
  }).execute()
  const subtreeMove = await updateFolderRow({
    id: moveRoot,
    organizationId: organizationA,
    projectId: projectB,
  })
  assert(subtreeMove.status === 'updated', 'subtree_move_succeeds')
  const [movedChild, movedAsset] = await Promise.all([
    db.selectFrom('folders')
      .select('projectId')
      .where('id', '=', moveChild)
      .executeTakeFirstOrThrow(),
    db.selectFrom('assets')
      .select('projectId')
      .where('id', '=', moveAssetId)
      .executeTakeFirstOrThrow(),
  ])
  assert(movedChild.projectId === projectB, 'subtree_descendant_moves')
  assert(movedAsset.projectId === projectB, 'subtree_asset_moves')

  const lockTarget = `lock-target-${suffix}`
  assert(
    (await addFolder({ id: lockTarget, projectId: projectA })).status
    === 'created',
    'lock_target_created',
  )
  let releaseLock = () => {}
  let signalLockHeld = () => {}
  const release = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  const lockHeld = new Promise<void>((resolve) => {
    signalLockHeld = resolve
  })
  const blocker = db.transaction().execute(async (trx) => {
    await lockFolderStructure(trx, organizationA)
    signalLockHeld()
    await release
  })
  await lockHeld
  let moveSettled = false
  const serializedMove = updateFolderRow({
    id: lockTarget,
    name: 'After lock',
    organizationId: organizationA,
  }).then((result) => {
    moveSettled = true
    return result
  })
  await delay(75)
  assert(!moveSettled, 'structural_move_waits_for_lock')
  releaseLock()
  await blocker
  assert(
    (await serializedMove).status === 'updated',
    'structural_move_resumes_after_lock',
  )

  const batchResult = await moveAssetRows({
    assetIds: [moveAssetId],
    folderId: projectBRoot,
    organizationId: organizationA,
    projectId: projectA,
  })
  assert(
    batchResult.status === 'not_found',
    'asset_cross_project_folder_mismatch_rejected',
  )
  return { otherTenantRoot, projectBRoot }
}

async function insertFlow(input: {
  assetFolderId?: null | string
  id: string
  organizationId?: string
  projectId?: null | string
}) {
  await db.insertInto('flows').values({
    assetFolderId: input.assetFolderId ?? null,
    createdBy: null,
    id: input.id,
    name: input.id,
    organizationId: input.organizationId ?? organizationA,
    projectId: input.projectId ?? null,
  }).execute()
}

async function resolveFlowDestination(
  flowId: string,
  explicit?: { folderId: null | string },
) {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('flows')
      .select('projectId')
      .where('organizationId', '=', organizationA)
      .where('id', '=', flowId)
      .executeTakeFirstOrThrow()
    await lockProjectScopes(trx, organizationA, [initial.projectId])
    await lockActiveProject(trx, organizationA, initial.projectId)
    await lockFolderStructure(trx, organizationA)
    const source = await trx.selectFrom('flows')
      .select(['assetFolderId', 'id', 'name', 'projectId'])
      .where('organizationId', '=', organizationA)
      .where('id', '=', flowId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    assert(source.projectId === initial.projectId, 'flow_scope_stable')
    return resolveAssetDestination({
      explicit,
      organizationId: organizationA,
      source: { ...source, kind: 'flow' },
      trx,
    })
  })
}

async function resolveCreateDestination(sessionId: string) {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('createSessions')
      .select('projectId')
      .where('organizationId', '=', organizationA)
      .where('id', '=', sessionId)
      .executeTakeFirstOrThrow()
    await lockProjectScopes(trx, organizationA, [initial.projectId])
    await lockActiveProject(trx, organizationA, initial.projectId)
    await lockFolderStructure(trx, organizationA)
    const source = await trx.selectFrom('createSessions')
      .select(['assetFolderId', 'id', 'name', 'projectId'])
      .where('organizationId', '=', organizationA)
      .where('id', '=', sessionId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    return resolveAssetDestination({
      organizationId: organizationA,
      source: { ...source, kind: 'create' },
      trx,
    })
  })
}

async function verifyDestinations(input: {
  otherTenantRoot: string
  projectBRoot: string
}) {
  const explicitFolder = `destination-explicit-${suffix}`
  const sourceFolder = `destination-source-${suffix}`
  const defaultFolder = `destination-default-${suffix}`
  for (const id of [explicitFolder, sourceFolder, defaultFolder]) {
    assert(
      (await addFolder({ id, projectId: projectA })).status === 'created',
      `${id}_created`,
    )
  }
  await db.updateTable('projects')
    .set({ defaultAssetFolderId: defaultFolder })
    .where('id', '=', projectA)
    .execute()

  const sourceFlow = `destination-source-flow-${suffix}`
  const explicitFlow = `destination-explicit-flow-${suffix}`
  const defaultFlow = `destination-default-flow-${suffix}`
  const rootFlow = `destination-root-flow-${suffix}`
  const privateFlow = `destination-private-flow-${suffix}`
  const projectSession = `destination-project-session-${suffix}`
  await insertFlow({
    assetFolderId: sourceFolder,
    id: sourceFlow,
    projectId: projectA,
  })
  await insertFlow({ id: explicitFlow, projectId: projectA })
  await insertFlow({ id: defaultFlow, projectId: projectA })
  await insertFlow({ id: rootFlow, projectId: projectB })
  await insertFlow({ id: privateFlow })
  await db.insertInto('createSessions').values({
    id: projectSession,
    name: 'Project Create session',
    organizationId: organizationA,
    projectId: projectA,
  }).execute()

  const explicit = await resolveFlowDestination(explicitFlow, {
    folderId: explicitFolder,
  })
  assert(explicit.folderId === explicitFolder, 'explicit_destination_wins')
  const explicitSource = await db.selectFrom('flows')
    .select('assetFolderId')
    .where('id', '=', explicitFlow)
    .executeTakeFirstOrThrow()
  assert(
    explicitSource.assetFolderId === null,
    'explicit_destination_does_not_mutate_source_default',
  )
  assert(
    (await resolveFlowDestination(sourceFlow)).folderId === sourceFolder,
    'source_output_folder_precedence',
  )
  assert(
    (await resolveFlowDestination(defaultFlow)).folderId === defaultFolder,
    'project_default_folder_precedence',
  )
  assert(
    (await resolveFlowDestination(rootFlow)).folderId === null,
    'project_root_fallback',
  )
  assert(
    (await resolveFlowDestination(sourceFlow, { folderId: null })).folderId
    === null,
    'explicit_root_wins',
  )
  const managed = await resolveFlowDestination(privateFlow)
  assert(managed.projectId === null, 'private_destination_stays_private')
  assert(Boolean(managed.folderId), 'private_managed_folder_created')
  const privateSource = await db.selectFrom('flows')
    .select('assetFolderId')
    .where('id', '=', privateFlow)
    .executeTakeFirstOrThrow()
  assert(
    privateSource.assetFolderId === managed.folderId,
    'private_managed_folder_associated',
  )
  const createDestination = await resolveCreateDestination(projectSession)
  const createSource = await db.selectFrom('createSessions')
    .select('assetFolderId')
    .where('id', '=', projectSession)
    .executeTakeFirstOrThrow()
  assert(
    createDestination.folderId === defaultFolder
    && createSource.assetFolderId === null,
    'project_create_uses_project_default',
  )
  await expectRejected(
    () => resolveFlowDestination(sourceFlow, {
      folderId: input.projectBRoot,
    }),
    'cross_project_destination_rejected',
  )
  await expectRejected(
    () => resolveFlowDestination(sourceFlow, {
      folderId: input.otherTenantRoot,
    }),
    'cross_tenant_destination_rejected',
  )

  const captured = await resolveFlowDestination(defaultFlow)
  assert(
    captured.folderId === defaultFolder,
    'capture_uses_project_default_folder',
  )
  await verifyCapturedFinalizationParity({
    capturedFolderId: captured.folderId,
    capturedProjectId: captured.projectId,
    flowId: defaultFlow,
    nextDefaultFolderId: explicitFolder,
    organizationId: organizationA,
    projectId: projectA,
    sourceFolderId: sourceFolder,
    suffix,
  })
}

async function main() {
  try {
    await seedScopes()
    const folderTargets = await verifyFolderInvariants()
    await verifyDestinations(folderTargets)
    console.log(
      'Projects runtime: tenant and Project scope, folder invariants and locking, destination precedence, immutable capture, and browser/managed finalization parity verified.',
    )
  }
  finally {
    await db.deleteFrom('organization')
      .where('id', 'in', [organizationA, organizationB])
      .execute()
    await destroyDb()
  }
}

await main()
