/**
 * Disposable PostgreSQL verification for direct Create run persistence.
 *
 * The caller supplies a PostgreSQL server dedicated to tests. This script
 * creates two uniquely named databases, proves fresh migration and the
 * 033 -> 034 -> 035 upgrade path, then drops only those databases in a finally
 * block.
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
const freshDatabaseName = `talelabs_create_fresh_${databaseSuffix}`
const upgradeDatabaseName = `talelabs_create_upgrade_${databaseSuffix}`

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

function migrationProvider() {
  return new FileMigrationProvider({
    fs,
    migrationFolder,
    path,
  })
}

async function migrate(
  database: Kysely<unknown>,
  target?: string,
) {
  const migrator = new Migrator({
    db: database,
    provider: migrationProvider(),
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

async function columnExists(
  database: Kysely<unknown>,
  tableName: string,
  columnName: string,
) {
  const result = await sql<{ exists: boolean }>`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${tableName}
        and column_name = ${columnName}
    ) as "exists"
  `.execute(database)
  return result.rows[0]?.exists === true
}

async function seedOrganization(database: Kysely<unknown>, suffix: string) {
  await sql`
    insert into "organization" ("id", "name", "slug", "createdAt")
    values (
      ${`organization-${suffix}`},
      'Migration verification',
      ${`migration-${suffix}`},
      now()
    )
  `.execute(database)
}

async function verifyFreshMigration(database: Kysely<unknown>) {
  await migrate(database)
  if (await columnExists(database, 'flows', 'surface'))
    throw new Error('fresh_schema_retained_flow_surface')
  if (!(await columnExists(database, 'flowRuns', 'source')))
    throw new Error('fresh_schema_missing_run_source')
  if (!(await columnExists(database, 'flowRuns', 'createSessionId')))
    throw new Error('fresh_schema_missing_create_session_reference')
  if (!(await columnExists(database, 'createSessions', 'id')))
    throw new Error('fresh_schema_missing_create_sessions')

  await seedOrganization(database, 'fresh')
  await sql`
    insert into "createSessions" (
      "id",
      "organizationId"
    )
    values (
      'fresh-create-session',
      'organization-fresh'
    )
  `.execute(database)
  await sql`
    insert into "flowRuns" (
      "id",
      "organizationId",
      "flowId",
      "createSessionId",
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
      'fresh-direct-run',
      'organization-fresh',
      null,
      'fresh-create-session',
      'direct',
      'create',
      '{}'::jsonb,
      5,
      repeat('a', 64),
      'migration-verifier',
      'fresh-direct-idempotency',
      'fresh-direct-request'
    )
  `.execute(database)
  await sql`
    insert into "flowRunNodes" (
      "organizationId",
      "flowRunId",
      "nodeId"
    )
    values (
      'organization-fresh',
      'fresh-direct-run',
      'direct-generation'
    )
  `.execute(database)
  await sql`
    insert into "flowRunNodeItems" (
      "organizationId",
      "flowRunId",
      "nodeId",
      "itemKey",
      "sortOrder"
    )
    values (
      'organization-fresh',
      'fresh-direct-run',
      'direct-generation',
      'direct-request',
      0
    )
  `.execute(database)
  await sql`
    insert into "generationJobs" (
      "id",
      "organizationId",
      "flowRunId",
      "flowId",
      "nodeId",
      "itemKey",
      "mediaType",
      "provider",
      "model",
      "operation",
      "providerModel",
      "catalogRevision",
      "providerRouteVersion",
      "adapterVersion",
      "idempotencyKey",
      "requestHash",
      "requestPayload"
    )
    values (
      'fresh-direct-job',
      'organization-fresh',
      'fresh-direct-run',
      null,
      'direct-generation',
      'direct-request',
      'image',
      'mock',
      'mock/image',
      'textToImage',
      'mock-image',
      'sha256:migration-verifier',
      'migration-verifier',
      'migration-verifier',
      'fresh-direct-job-idempotency',
      'fresh-direct-job-request',
      '{"requestPayloadVersion": 6}'::jsonb
    )
  `.execute(database)

  await sql`
    update "createSessions"
    set "deletedAt" = now()
    where "id" = 'fresh-create-session'
  `.execute(database)
  const retainedRun = await sql<{ count: number }>`
    select count(*)::integer as "count"
    from "flowRuns"
    where "id" = 'fresh-direct-run'
      and "createSessionId" = 'fresh-create-session'
  `.execute(database)
  if (retainedRun.rows[0]?.count !== 1)
    throw new Error('session_soft_delete_removed_run_history')
}

async function seedHistoricalCreateFlow(database: Kysely<unknown>) {
  await seedOrganization(database, 'upgrade')
  await sql`
    insert into "flows" ("id", "organizationId", "name", "surface")
    values
      ('historical-create-flow', 'organization-upgrade', 'Old Create', 'create'),
      ('ordinary-canvas-flow', 'organization-upgrade', 'Canvas', 'canvas')
  `.execute(database)
  await sql`
    insert into "flowRuns" (
      "id",
      "organizationId",
      "flowId",
      "mode",
      "status",
      "graphSnapshot",
      "snapshotVersion",
      "snapshotHash",
      "executorVersion",
      "idempotencyKey",
      "requestHash",
      "completedAt"
    )
    values (
      'historical-create-run',
      'organization-upgrade',
      'historical-create-flow',
      'all',
      'succeeded',
      '{}'::jsonb,
      4,
      repeat('b', 64),
      'migration-verifier',
      'historical-create-idempotency',
      'historical-create-request',
      now()
    )
  `.execute(database)
  await sql`
    insert into "flowRunNodes" (
      "organizationId",
      "flowRunId",
      "nodeId",
      "status"
    )
    values (
      'organization-upgrade',
      'historical-create-run',
      'historical-node',
      'succeeded'
    )
  `.execute(database)
  await sql`
    insert into "flowRunNodeItems" (
      "organizationId",
      "flowRunId",
      "nodeId",
      "itemKey",
      "sortOrder",
      "status"
    )
    values (
      'organization-upgrade',
      'historical-create-run',
      'historical-node',
      'historical-item',
      0,
      'succeeded'
    )
  `.execute(database)
  await sql`
    insert into "generationJobs" (
      "id",
      "organizationId",
      "flowRunId",
      "flowId",
      "nodeId",
      "itemKey",
      "mediaType",
      "status",
      "provider",
      "model",
      "operation",
      "providerModel",
      "catalogRevision",
      "providerRouteVersion",
      "adapterVersion",
      "idempotencyKey",
      "requestHash",
      "requestPayload",
      "completedAt"
    )
    values (
      'historical-create-job',
      'organization-upgrade',
      'historical-create-run',
      'historical-create-flow',
      'historical-node',
      'historical-item',
      'image',
      'succeeded',
      'mock',
      'mock/image',
      'textToImage',
      'mock-image',
      'sha256:migration-verifier',
      'migration-verifier',
      'migration-verifier',
      'historical-create-job-idempotency',
      'historical-create-job-request',
      '{"requestPayloadVersion": 0, "legacyJobId": "historical-create-job"}'::jsonb,
      now()
    )
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
      "generationJobId",
      "outputIndex",
      "processingState"
    )
    values (
      'historical-create-asset',
      'organization-upgrade',
      'Preserved output',
      'image',
      'generation',
      'migration-verification/historical-create-asset',
      'image/png',
      'historical-create-job',
      0,
      'ready'
    )
  `.execute(database)
}

async function verifyUpgradeMigration(database: Kysely<unknown>) {
  await migrate(database, '033_flow_surfaces')
  await seedHistoricalCreateFlow(database)
  await migrate(database, '034_direct_create_runs')
  await sql`
    insert into "flowRuns" (
      "id",
      "organizationId",
      "flowId",
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
      'upgrade-direct-run',
      'organization-upgrade',
      null,
      'direct',
      'create',
      '{}'::jsonb,
      5,
      repeat('c', 64),
      'migration-verifier',
      'upgrade-direct-idempotency',
      'upgrade-direct-request'
    )
  `.execute(database)
  await migrate(database)

  if (await columnExists(database, 'flows', 'surface'))
    throw new Error('upgrade_retained_flow_surface')
  const facts = await sql<{
    assetCount: number
    canvasFlowCount: number
    createFlowCount: number
    jobFlowId: null | string
    backfilledSessionCount: number
    directRunSessionId: null | string
    runFlowId: null | string
    runSessionId: null | string
    runSource: string
  }>`
    select
      (select count(*)::integer from "flows"
        where "id" = 'historical-create-flow') as "createFlowCount",
      (select count(*)::integer from "flows"
        where "id" = 'ordinary-canvas-flow') as "canvasFlowCount",
      (select "flowId" from "flowRuns"
        where "id" = 'historical-create-run') as "runFlowId",
      (select "source" from "flowRuns"
        where "id" = 'historical-create-run') as "runSource",
      (select "createSessionId" from "flowRuns"
        where "id" = 'historical-create-run') as "runSessionId",
      (select "createSessionId" from "flowRuns"
        where "id" = 'upgrade-direct-run') as "directRunSessionId",
      (select count(*)::integer from "createSessions"
        where "id" = 'upgrade-direct-run'
          and "organizationId" = 'organization-upgrade'
      ) as "backfilledSessionCount",
      (select "flowId" from "generationJobs"
        where "id" = 'historical-create-job') as "jobFlowId",
      (select count(*)::integer from "assets"
        where "id" = 'historical-create-asset') as "assetCount"
  `.execute(database)
  const row = facts.rows[0]
  if (
    !row
    || row.createFlowCount !== 0
    || row.canvasFlowCount !== 1
    || row.runFlowId !== null
    || row.runSource !== 'flow'
    || row.runSessionId !== null
    || row.directRunSessionId !== 'upgrade-direct-run'
    || row.backfilledSessionCount !== 1
    || row.jobFlowId !== null
    || row.assetCount !== 1
  ) {
    throw new Error(`upgrade_preservation_failed:${JSON.stringify(row)}`)
  }

  await sql`
    update "flowRuns"
    set "triggerDeploymentVersion" = 'deployment-one'
    where "id" = 'historical-create-run'
  `.execute(database)
  let immutableDeploymentRejected = false
  try {
    await sql`
      update "flowRuns"
      set "triggerDeploymentVersion" = 'deployment-two'
      where "id" = 'historical-create-run'
    `.execute(database)
  }
  catch {
    immutableDeploymentRejected = true
  }
  if (!immutableDeploymentRejected)
    throw new Error('trigger_deployment_immutability_lost')
}

async function main() {
  assertSafeDatabaseName(freshDatabaseName)
  assertSafeDatabaseName(upgradeDatabaseName)
  const admin = new Pool({
    connectionString: adminConnectionString,
    max: 1,
  })
  const databases: Kysely<unknown>[] = []
  try {
    await admin.query(`create database "${freshDatabaseName}"`)
    await admin.query(`create database "${upgradeDatabaseName}"`)
    const fresh = createDatabase(
      connectionStringForDatabase(freshDatabaseName),
    )
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
      'Migrations 034-035: fresh schema, 033 upgrade, direct-session backfill, Flow cleanup, retained history, and immutability verified.',
    )
  }
  finally {
    await Promise.all(databases.map(database => database.destroy()))
    for (const name of [freshDatabaseName, upgradeDatabaseName]) {
      await admin.query(`drop database if exists "${name}" with (force)`)
    }
    await admin.end()
  }
}

await main()
