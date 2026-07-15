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

export const pool = new Pool({
  connectionTimeoutMillis: POSTGRES_POOL_CONFIG.connectionTimeoutMillis,
  connectionString: preserveVerifiedSslMode(connectionString),
  max: POSTGRES_POOL_CONFIG.max,
})

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
})

export async function destroyDb() {
  await db.destroy()
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
