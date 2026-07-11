import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "folders"
      add column "systemRole" text
  `.execute(db)
  await sql`
    create unique index "foldersSystemRoleIdx"
      on "folders" ("organizationId", "systemRole")
      where "systemRole" is not null
  `.execute(db)

  await sql`
    alter table "elements"
      add column "assetFolderId" text
  `.execute(db)
  await sql`
    alter table "elements"
      add constraint "elementsAssetFolderFk"
      foreign key ("assetFolderId", "organizationId")
      references "folders" ("id", "organizationId")
      on delete set null ("assetFolderId")
  `.execute(db)
  await sql`
    create unique index "elementsAssetFolderIdx"
      on "elements" ("assetFolderId")
      where "assetFolderId" is not null
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop index if exists "elementsAssetFolderIdx"`.execute(db)
  await sql`
    alter table "elements"
      drop constraint if exists "elementsAssetFolderFk",
      drop column if exists "assetFolderId"
  `.execute(db)

  await sql`drop index if exists "foldersSystemRoleIdx"`.execute(db)
  await sql`
    alter table "folders"
      drop column if exists "systemRole"
  `.execute(db)
}
