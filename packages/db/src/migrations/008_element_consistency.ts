import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "elementAssets"
      add column "referenceKind" text not null default 'master',
      add column "referenceMetadata" jsonb not null default '{}'::jsonb,
      add constraint "elementAssetsReferenceKindCheck"
        check ("referenceKind" in ('source', 'master')),
      add constraint "elementAssetsSourceNotPrimaryCheck"
        check ("referenceKind" <> 'source' or not "isPrimary")
  `.execute(db)

  // Supports organization-scoped, master-only Element/Flow reads without
  // indexing source evidence that those hot paths must never consume.
  await sql`
    create index "elementAssetsMasterElementIdx"
      on "elementAssets" (
        "organizationId",
        "elementId",
        "role",
        "sortOrder",
        "assetId"
      )
      where "referenceKind" = 'master'
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop index if exists "elementAssetsMasterElementIdx"`.execute(db)
  await sql`
    alter table "elementAssets"
      drop constraint if exists "elementAssetsSourceNotPrimaryCheck",
      drop constraint if exists "elementAssetsReferenceKindCheck",
      drop column if exists "referenceMetadata",
      drop column if exists "referenceKind"
  `.execute(db)
}
