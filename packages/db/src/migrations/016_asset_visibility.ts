import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "assets"
      add column "visibility" text not null default 'private',
      add constraint "assetsVisibilityCheck"
        check ("visibility" in ('private', 'public'))
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`
    alter table "assets"
      drop constraint if exists "assetsVisibilityCheck",
      drop column if exists "visibility"
  `.execute(db)
}
