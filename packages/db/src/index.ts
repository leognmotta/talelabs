import type { Database } from './schema.js'

import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'

import { preserveVerifiedSslMode } from './connection-string.js'
import './env.js'

const connectionString = process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error(
    'POSTGRES_URL is required to initialize @talelabs/db. Add it to the root .env file.',
  )
}

export const pool = new Pool({
  connectionString: preserveVerifiedSslMode(connectionString),
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
export type { Database }
export type * from './schema.js'
