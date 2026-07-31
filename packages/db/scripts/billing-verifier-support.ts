/** Reusable disposable-database and fixture helpers for M8 certification. */

import type { Database } from '../src/schema.js'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  PostgresDialect,
  sql,
} from 'kysely'
import { Pool } from 'pg'

const migrationFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/migrations',
)

export {
  assertSafeDatabaseName,
  connectionStringForDatabase,
} from './postgres-verifier-runtime.js'

/** Fails one verifier scenario when its expected invariant is false. */
export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition)
    throw new Error(message)
}

/** Creates a bounded Kysely client for one disposable verification database. */
export function createVerifierDatabase(connectionString: string) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString, max: 8 }),
    }),
  })
}

/** Migrates a disposable database to one target or the current latest schema. */
export async function migrateVerifierDatabase(
  database: Kysely<Database>,
  target?: string,
) {
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

/** Requires a database operation to reject for the named invariant. */
export async function expectRejected(
  operation: () => Promise<unknown>,
  label: string,
) {
  try {
    await operation()
  }
  catch {
    return
  }
  throw new Error(`expected_rejection_missing:${label}`)
}

/** Seeds one verifier actor and a bounded set of tenant identities. */
export async function seedVerifierIdentity(
  database: Kysely<Database>,
  organizations: readonly string[],
) {
  await sql`
    insert into "user" (
      "id", "name", "email", "emailVerified", "updatedAt"
    )
    values (
      'billing-verifier-user',
      'Billing Verifier',
      'billing-verifier@invalid.example',
      true,
      now()
    )
  `.execute(database)
  for (const organizationId of organizations) {
    await sql`
      insert into "organization" ("id", "name", "slug", "createdAt")
      values (
        ${organizationId},
        ${`Billing ${organizationId}`},
        ${organizationId},
        now()
      )
    `.execute(database)
  }
}

/** Seeds one production-shaped direct run with the requested job count. */
export async function seedVerifierRun(
  database: Kysely<Database>,
  organizationId: string,
  runSuffix: string,
  jobCount: number,
  executionRuntime: 'browser' | 'managed' = 'managed',
) {
  const sessionId = `session-${runSuffix}`
  const runId = `run-${runSuffix}`
  const nodeId = `node-${runSuffix}`
  const itemId = `item-${runSuffix}`
  await sql`
    insert into "createSessions" ("id", "organizationId")
    values (${sessionId}, ${organizationId})
  `.execute(database)
  await sql`
    insert into "flowRuns" (
      "id",
      "organizationId",
      "flowId",
      "createSessionId",
      "mode",
      "source",
      "executionRuntime",
      "graphSnapshot",
      "snapshotVersion",
      "snapshotHash",
      "executorVersion",
      "idempotencyKey",
      "requestHash"
    )
    values (
      ${runId},
      ${organizationId},
      null,
      ${sessionId},
      'direct',
      'create',
      ${executionRuntime},
      '{}'::jsonb,
      5,
      ${'a'.repeat(64)},
      'billing-verifier',
      ${`idempotency-${runSuffix}`},
      ${`request-${runSuffix}`}
    )
  `.execute(database)
  await sql`
    insert into "flowRunNodes" (
      "organizationId", "flowRunId", "nodeId"
    )
    values (${organizationId}, ${runId}, ${nodeId})
  `.execute(database)
  await sql`
    insert into "flowRunNodeItems" (
      "organizationId", "flowRunId", "nodeId", "itemKey", "sortOrder"
    )
    values (${organizationId}, ${runId}, ${nodeId}, ${itemId}, 0)
  `.execute(database)
  const jobIds: string[] = []
  for (let index = 0; index < jobCount; index += 1) {
    const jobId = `job-${runSuffix}-${index}`
    jobIds.push(jobId)
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
        "requestIndex",
        "idempotencyKey",
        "requestHash",
        "requestPayload"
      )
      values (
        ${jobId},
        ${organizationId},
        ${runId},
        null,
        ${nodeId},
        ${itemId},
        'image',
        'mock',
        'mock/image',
        'textToImage',
        'mock-image',
        'sha256:billing-verifier',
        'billing-verifier',
        'billing-verifier',
        ${index},
        ${`job-idempotency-${runSuffix}-${index}`},
        ${`job-request-${runSuffix}-${index}`},
        '{"requestPayloadVersion":6,"outputCount":1}'::jsonb
      )
    `.execute(database)
  }
  return { jobIds, runId }
}
