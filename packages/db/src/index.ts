/**
 * PostgreSQL pool composition and caller-owned transaction primitives.
 *
 * @packageDocumentation
 */

import type { Transaction } from 'kysely'
import type { Database } from './schema.js'

import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'

import { preserveVerifiedSslMode } from './connection-string.js'
import { POSTGRES_POOL_CONFIG } from './pool-config.js'
import './env.js'

const connectionString = process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error(
    'POSTGRES_URL is required to initialize @talelabs/db. Add it to the root .env file.',
  )
}

/** Shared bounded PostgreSQL connection pool for TaleLabs server processes. */
export const pool = new Pool({
  connectionTimeoutMillis: POSTGRES_POOL_CONFIG.connectionTimeoutMillis,
  connectionString: preserveVerifiedSslMode(connectionString),
  max: POSTGRES_POOL_CONFIG.max,
})

/** Typed Kysely database entry point backed by the shared pool. */
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
})

/** Closes the shared database pool during process or verification teardown. */
export async function destroyDb() {
  await db.destroy()
}

/**
 * Query executor accepted by helpers that must run inside a caller-owned
 * transaction. Passing an open transaction keeps every statement on the one
 * pooled connection the caller already holds.
 */
export type DatabaseExecutor = Kysely<Database> | Transaction<Database>

/** Runs the operation inside the executor, reusing an already-open transaction. */
export async function withDatabaseTransaction<Result>(
  executor: DatabaseExecutor,
  operation: (trx: Transaction<Database>) => Promise<Result>,
): Promise<Result> {
  return executor.isTransaction
    ? operation(executor as Transaction<Database>)
    : executor.transaction().execute(operation)
}

export { sql }
export {
  availableFolderName,
  FLOW_OUTPUTS_ROOT_FOLDER_NAME,
  FLOW_OUTPUTS_ROOT_SYSTEM_ROLE,
  lockFolderStructure,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS_PER_ORGANIZATION,
} from './folder-coordination.js'
export { POSTGRES_POOL_CONFIG } from './pool-config.js'
export type { Database }
export type { PostgresPoolConfig } from './pool-config.js'
export type * from './schema.js'
export type { Transaction } from 'kysely'
