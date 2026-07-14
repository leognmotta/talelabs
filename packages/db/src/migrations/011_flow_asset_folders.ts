import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flows"
      add column "assetFolderId" text
  `.execute(db)
  await sql`
    alter table "flows"
      add constraint "flowsAssetFolderFk"
      foreign key ("assetFolderId", "organizationId")
      references "folders" ("id", "organizationId")
      on delete set null ("assetFolderId")
  `.execute(db)
  await sql`
    create unique index "flowsAssetFolderIdx"
      on "flows" ("assetFolderId")
      where "assetFolderId" is not null
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop index if exists "flowsAssetFolderIdx"`.execute(db)
  await sql`
    alter table "flows"
      drop constraint if exists "flowsAssetFolderFk",
      drop column if exists "assetFolderId"
  `.execute(db)
}
