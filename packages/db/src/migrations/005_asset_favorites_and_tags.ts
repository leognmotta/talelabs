import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    create table "assetFavorites" (
      "organizationId" text not null references "organization"("id") on delete cascade,
      "userId" text not null references "user"("id") on delete cascade,
      "assetId" text not null,
      "createdAt" timestamptz not null default now(),
      primary key ("organizationId", "userId", "assetId"),
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId") on delete cascade
    )
  `.execute(db)
  await sql`
    create index "assetFavoritesAssetIdx"
      on "assetFavorites" ("organizationId", "assetId")
  `.execute(db)

  await sql`
    create table "tags" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "createdBy" text references "user"("id") on delete set null,
      "name" text not null,
      "normalizedName" text not null,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("id", "organizationId"),
      unique ("organizationId", "normalizedName")
    )
  `.execute(db)
  await sql`
    create index "tagsOrgNameIdx"
      on "tags" ("organizationId", "normalizedName", "id")
  `.execute(db)

  await sql`
    create table "assetTags" (
      "organizationId" text not null references "organization"("id") on delete cascade,
      "assetId" text not null,
      "tagId" text not null,
      "createdBy" text references "user"("id") on delete set null,
      "createdAt" timestamptz not null default now(),
      primary key ("assetId", "tagId"),
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId") on delete cascade,
      foreign key ("tagId", "organizationId")
        references "tags" ("id", "organizationId") on delete cascade
    )
  `.execute(db)
  await sql`
    create index "assetTagsOrgTagIdx"
      on "assetTags" ("organizationId", "tagId", "assetId")
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop table if exists "assetTags"`.execute(db)
  await sql`drop table if exists "tags"`.execute(db)
  await sql`drop table if exists "assetFavorites"`.execute(db)
}
