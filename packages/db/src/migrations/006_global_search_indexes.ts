import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`create extension if not exists pg_trgm`.execute(db)
  await sql`
    create index "assetsNameSearchIdx"
      on "assets" using gin (lower("name") gin_trgm_ops)
      where "deletedAt" is null and "purgeRequestedAt" is null
  `.execute(db)
  await sql`
    create index "foldersNameSearchIdx"
      on "folders" using gin (lower("name") gin_trgm_ops)
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop index if exists "foldersNameSearchIdx"`.execute(db)
  await sql`drop index if exists "assetsNameSearchIdx"`.execute(db)
  await sql`drop extension if exists pg_trgm`.execute(db)
}
