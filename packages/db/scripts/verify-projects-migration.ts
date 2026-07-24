/**
 * Disposable PostgreSQL verification for Project organization persistence.
 *
 * The caller supplies a PostgreSQL server dedicated to tests. The script
 * creates isolated databases for a fresh migration and a 035 upgrade, then
 * drops only those generated databases in a finally block.
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
  sql,
} from 'kysely'
import { Pool } from 'pg'

const adminConnectionString = process.env.TEST_POSTGRES_URL
if (!adminConnectionString)
  throw new Error('TEST_POSTGRES_URL is required')

const migrationFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/migrations',
)
const databaseSuffix = `${process.pid}_${Date.now()}`
const freshDatabaseName = `talelabs_projects_fresh_${databaseSuffix}`
const upgradeDatabaseName = `talelabs_projects_upgrade_${databaseSuffix}`

function assertSafeDatabaseName(name: string) {
  if (!/^[a-z0-9_]+$/.test(name))
    throw new Error('unsafe_disposable_database_name')
}

function connectionStringForDatabase(databaseName: string) {
  assertSafeDatabaseName(databaseName)
  const value = new URL(adminConnectionString)
  value.pathname = `/${databaseName}`
  return value.toString()
}

function createDatabase(connectionString: string) {
  return new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString, max: 2 }),
    }),
  })
}

async function migrate(database: Kysely<unknown>, target?: string) {
  const migrator = new Migrator({
    db: database,
    provider: new FileMigrationProvider({
      fs,
      migrationFolder,
      path,
    }),
  })
  const result = target
    ? await migrator.migrateTo(target)
    : await migrator.migrateToLatest()
  if (result.error)
    throw result.error
  const failed = result.results?.find(item => item.status === 'Error')
  if (failed)
    throw new Error(`migration_failed:${failed.migrationName}`)
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
  if (!rejected)
    throw new Error(`expected_rejection_missing:${label}`)
}

async function seedOrganizations(database: Kysely<unknown>) {
  await sql`
    insert into "organization" ("id", "name", "slug", "createdAt")
    values
      ('project-org-a', 'Project A', 'project-a', now()),
      ('project-org-b', 'Project B', 'project-b', now())
  `.execute(database)
}

async function verifyFreshMigration(database: Kysely<unknown>) {
  await migrate(database)
  await seedOrganizations(database)
  await sql`
    insert into "projects" (
      "id",
      "organizationId",
      "name",
      "description"
    )
    values
      ('project-a-one', 'project-org-a', 'One', 'First project'),
      ('project-a-two', 'project-org-a', 'Two', 'Second project'),
      ('project-b-one', 'project-org-b', 'Other', 'Other tenant')
  `.execute(database)
  await sql`
    insert into "folders" (
      "id",
      "organizationId",
      "projectId",
      "parentId",
      "name"
    )
    values
      (
        'project-folder-a-root',
        'project-org-a',
        'project-a-one',
        null,
        'Root A'
      ),
      (
        'project-folder-a-child',
        'project-org-a',
        'project-a-one',
        'project-folder-a-root',
        'Child A'
      ),
      (
        'project-folder-b-root',
        'project-org-a',
        'project-a-two',
        null,
        'Root B'
      ),
      (
        'project-folder-private',
        'project-org-a',
        null,
        null,
        'Private'
      )
  `.execute(database)
  await sql`
    insert into "assets" (
      "id",
      "organizationId",
      "projectId",
      "name",
      "type",
      "source",
      "storageKey",
      "mimeType",
      "folderId",
      "uploadId",
      "processingState"
    )
    values (
      'project-asset-a',
      'project-org-a',
      'project-a-one',
      'Cover',
      'image',
      'upload',
      'projects-verification/asset-a',
      'image/png',
      'project-folder-a-child',
      'projects-verification-upload-a',
      'ready'
    )
  `.execute(database)
  await sql`
    insert into "flows" (
      "id",
      "organizationId",
      "projectId",
      "name",
      "assetFolderId"
    )
    values (
      'project-flow-a',
      'project-org-a',
      'project-a-one',
      'Flow A',
      'project-folder-a-root'
    )
  `.execute(database)
  await sql`
    insert into "createSessions" (
      "id",
      "organizationId",
      "projectId",
      "assetFolderId"
    )
    values (
      'project-session-a',
      'project-org-a',
      'project-a-one',
      'project-folder-a-child'
    )
  `.execute(database)
  await sql`
    insert into "elements" (
      "id",
      "organizationId",
      "projectId",
      "kind",
      "name"
    )
    values (
      'project-element-a',
      'project-org-a',
      'project-a-one',
      'style',
      'Element A'
    )
  `.execute(database)
  await sql`
    insert into "flowRuns" (
      "id",
      "organizationId",
      "flowId",
      "createSessionId",
      "projectId",
      "assetFolderId",
      "mode",
      "source",
      "graphSnapshot",
      "snapshotVersion",
      "snapshotHash",
      "executorVersion",
      "idempotencyKey",
      "requestHash"
    )
    values (
      'project-run-a',
      'project-org-a',
      null,
      'project-session-a',
      'project-a-one',
      'project-folder-a-child',
      'direct',
      'create',
      '{}'::jsonb,
      5,
      repeat('d', 64),
      'projects-verifier',
      'project-run-a-idempotency',
      'project-run-a-request'
    )
  `.execute(database)
  await sql`
    insert into "projectBriefs" (
      "projectId",
      "organizationId",
      "document",
      "plainText"
    )
    values (
      'project-a-one',
      'project-org-a',
      '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
      ''
    )
  `.execute(database)
  await sql`
    update "projects"
    set
      "coverAssetId" = 'project-asset-a',
      "defaultAssetFolderId" = 'project-folder-a-root'
    where "id" = 'project-a-one'
  `.execute(database)

  await expectRejected(() => sql`
    insert into "elements" (
      "id",
      "organizationId",
      "projectId",
      "kind",
      "name"
    )
    values (
      'cross-tenant-element',
      'project-org-a',
      'project-b-one',
      'style',
      'Cross tenant'
    )
  `.execute(database), 'cross_tenant_project')
  await expectRejected(() => sql`
    update "folders"
    set "parentId" = 'project-folder-b-root'
    where "id" = 'project-folder-a-child'
  `.execute(database), 'cross_project_parent')
  await expectRejected(() => sql`
    update "assets"
    set "projectId" = 'project-a-two'
    where "id" = 'project-asset-a'
  `.execute(database), 'asset_folder_project_mismatch')
  await expectRejected(() => sql`
    update "flows"
    set "projectId" = 'project-a-two'
    where "id" = 'project-flow-a'
  `.execute(database), 'flow_folder_project_mismatch')
  await expectRejected(() => sql`
    update "projects"
    set "coverAssetId" = 'project-asset-a'
    where "id" = 'project-a-two'
  `.execute(database), 'project_cover_scope')
  await expectRejected(() => sql`
    update "flowRuns"
    set "assetFolderId" = 'project-folder-b-root'
    where "id" = 'project-run-a'
  `.execute(database), 'run_destination_immutability')

  await database.transaction().execute(async (trx) => {
    await sql`
      update "projects"
      set "coverAssetId" = null, "defaultAssetFolderId" = null
      where "id" = 'project-a-one'
    `.execute(trx)
    await sql`
      update "folders"
      set "projectId" = 'project-a-two'
      where "id" in (
        'project-folder-a-root',
        'project-folder-a-child'
      )
    `.execute(trx)
    await sql`
      update "assets"
      set "projectId" = 'project-a-two'
      where "id" = 'project-asset-a'
    `.execute(trx)
    await sql`
      update "flows"
      set "projectId" = 'project-a-two'
      where "id" = 'project-flow-a'
    `.execute(trx)
    await sql`
      update "createSessions"
      set "projectId" = 'project-a-two'
      where "id" = 'project-session-a'
    `.execute(trx)
  })

  const facts = await sql<{
    assetProjectId: string
    childProjectId: string
    runProjectId: string
    sessionProjectId: string
  }>`
    select
      (select "projectId" from "assets"
        where "id" = 'project-asset-a') as "assetProjectId",
      (select "projectId" from "folders"
        where "id" = 'project-folder-a-child') as "childProjectId",
      (select "projectId" from "createSessions"
        where "id" = 'project-session-a') as "sessionProjectId",
      (select "projectId" from "flowRuns"
        where "id" = 'project-run-a') as "runProjectId"
  `.execute(database)
  const row = facts.rows[0]
  if (
    row?.assetProjectId !== 'project-a-two'
    || row.childProjectId !== 'project-a-two'
    || row.sessionProjectId !== 'project-a-two'
    || row.runProjectId !== 'project-a-one'
  ) {
    throw new Error(`project_subtree_or_run_history_failed:${JSON.stringify(row)}`)
  }
}

async function verifyUpgradeMigration(database: Kysely<unknown>) {
  await migrate(database, '035_create_sessions')
  await sql`
    insert into "organization" ("id", "name", "slug", "createdAt")
    values ('project-upgrade-org', 'Upgrade', 'project-upgrade', now())
  `.execute(database)
  await sql`
    insert into "folders" (
      "id",
      "organizationId",
      "parentId",
      "name",
      "systemRole"
    )
    values
      (
        'project-upgrade-flow-root',
        'project-upgrade-org',
        null,
        'Flow',
        'flows_root'
      ),
      (
        'project-upgrade-flow-output',
        'project-upgrade-org',
        'project-upgrade-flow-root',
        'Existing Flow',
        null
      )
  `.execute(database)
  await sql`
    insert into "flows" (
      "id",
      "organizationId",
      "name",
      "assetFolderId"
    )
    values (
      'project-upgrade-flow',
      'project-upgrade-org',
      'Existing Flow',
      'project-upgrade-flow-output'
    )
  `.execute(database)
  await sql`
    insert into "createSessions" ("id", "organizationId")
    values ('project-upgrade-session', 'project-upgrade-org')
  `.execute(database)
  await sql`
    insert into "assets" (
      "id",
      "organizationId",
      "name",
      "type",
      "source",
      "storageKey",
      "mimeType",
      "folderId",
      "uploadId",
      "processingState"
    )
    values (
      'project-upgrade-asset',
      'project-upgrade-org',
      'Existing Asset',
      'image',
      'upload',
      'projects-verification/upgrade-asset',
      'image/png',
      'project-upgrade-flow-output',
      'projects-verification-upgrade-upload',
      'ready'
    )
  `.execute(database)
  await sql`
    insert into "elements" (
      "id",
      "organizationId",
      "kind",
      "name"
    )
    values (
      'project-upgrade-element',
      'project-upgrade-org',
      'style',
      'Existing Element'
    )
  `.execute(database)
  await migrate(database, '036_projects_and_asset_organization')
  await sql`
    insert into "projects" (
      "id",
      "organizationId",
      "name"
    )
    values (
      'project-upgrade-repair',
      'project-upgrade-org',
      'Repair'
    )
  `.execute(database)
  await sql`
    insert into "assets" (
      "id",
      "organizationId",
      "projectId",
      "name",
      "type",
      "source",
      "storageKey",
      "mimeType",
      "uploadId",
      "processingState",
      "purgeRequestedAt"
    )
    values (
      'project-upgrade-purged-cover',
      'project-upgrade-org',
      'project-upgrade-repair',
      'Purged cover',
      'image',
      'upload',
      'projects-verification/purged-cover',
      'image/png',
      'projects-verification-purged-cover',
      'ready',
      now()
    )
  `.execute(database)
  await sql`
    update "projects"
    set "coverAssetId" = 'project-upgrade-purged-cover'
    where "id" = 'project-upgrade-repair'
  `.execute(database)
  await migrate(database)

  const facts = await sql<{
    assetFolderId: string
    assetProjectId: null | string
    elementProjectId: null | string
    flowFolderId: string
    flowProjectId: null | string
    folderProjectId: null | string
    folderSystemRole: string
    repairedCoverAssetId: null | string
    sessionFolderId: null | string
    sessionProjectId: null | string
  }>`
    select
      (select "projectId" from "assets"
        where "id" = 'project-upgrade-asset') as "assetProjectId",
      (select "folderId" from "assets"
        where "id" = 'project-upgrade-asset') as "assetFolderId",
      (select "projectId" from "folders"
        where "id" = 'project-upgrade-flow-output') as "folderProjectId",
      (select "systemRole" from "folders"
        where "id" = 'project-upgrade-flow-output') as "folderSystemRole",
      (select "projectId" from "flows"
        where "id" = 'project-upgrade-flow') as "flowProjectId",
      (select "assetFolderId" from "flows"
        where "id" = 'project-upgrade-flow') as "flowFolderId",
      (select "projectId" from "createSessions"
        where "id" = 'project-upgrade-session') as "sessionProjectId",
      (select "assetFolderId" from "createSessions"
        where "id" = 'project-upgrade-session') as "sessionFolderId",
      (select "projectId" from "elements"
        where "id" = 'project-upgrade-element') as "elementProjectId",
      (select "coverAssetId" from "projects"
        where "id" = 'project-upgrade-repair') as "repairedCoverAssetId"
  `.execute(database)
  const row = facts.rows[0]
  if (
    row?.assetProjectId !== null
    || row.assetFolderId !== 'project-upgrade-flow-output'
    || row.folderProjectId !== null
    || row.folderSystemRole !== 'flow_output:project-upgrade-flow'
    || row.flowProjectId !== null
    || row.flowFolderId !== 'project-upgrade-flow-output'
    || row.sessionProjectId !== null
    || row.sessionFolderId !== null
    || row.elementProjectId !== null
    || row.repairedCoverAssetId !== null
  ) {
    throw new Error(`project_upgrade_preservation_failed:${JSON.stringify(row)}`)
  }
}

async function main() {
  assertSafeDatabaseName(freshDatabaseName)
  assertSafeDatabaseName(upgradeDatabaseName)
  const admin = new Pool({ connectionString: adminConnectionString, max: 1 })
  const databases: Kysely<unknown>[] = []
  try {
    await admin.query(`create database "${freshDatabaseName}"`)
    await admin.query(`create database "${upgradeDatabaseName}"`)

    const fresh = createDatabase(connectionStringForDatabase(freshDatabaseName))
    databases.push(fresh)
    await verifyFreshMigration(fresh)
    await fresh.destroy()
    databases.pop()

    const upgrade = createDatabase(
      connectionStringForDatabase(upgradeDatabaseName),
    )
    databases.push(upgrade)
    await verifyUpgradeMigration(upgrade)
    await upgrade.destroy()
    databases.pop()
    console.log(
      'Migrations 036-037: fresh schema, 035 upgrade, Private preservation, scoped constraints, atomic subtree moves, immutable run destinations, and purged-cover repair verified.',
    )
  }
  finally {
    await Promise.all(databases.map(database => database.destroy()))
    for (const name of [freshDatabaseName, upgradeDatabaseName])
      await admin.query(`drop database if exists "${name}" with (force)`)
    await admin.end()
  }
}

await main()
