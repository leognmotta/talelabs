import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`alter table "user" add column if not exists "locale" text`.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`alter table "user" drop column if exists "locale"`.execute(db)
}
