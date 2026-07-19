/**
 * Replaces the retired multi-role Element experiment with the simplified
 * Elements model: one Element is a named, ordered collection of reference
 * image Assets. Failed-experiment rows are deleted by explicit product
 * decision; canonical Assets and folders are untouched.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Drops the retired Element schema and creates the simplified tables. */
export async function up(db: Kysely<unknown>) {
  await sql`drop table if exists "elementAssets"`.execute(db)

  // Provenance rows keep their elementId value; only the constraint against
  // the dropped experiment table is released and later re-pointed.
  await sql`
    do $$
    declare constraint_name text;
    begin
      select conname into constraint_name
      from pg_constraint
      where conrelid = '"generationJobSources"'::regclass
        and confrelid = '"elements"'::regclass;
      if constraint_name is not null then
        execute format(
          'alter table "generationJobSources" drop constraint %I',
          constraint_name
        );
      end if;
    end $$
  `.execute(db)

  await sql`drop table if exists "elements"`.execute(db)

  // The retired lazily provisioned Elements root becomes an ordinary folder;
  // user media inside it stays exactly where it is.
  await sql`
    update "folders"
    set "systemRole" = null, "updatedAt" = now()
    where "systemRole" = 'elements_root'
  `.execute(db)

  await sql`
    create table "elements" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "createdBy" text references "user"("id") on delete set null,
      "kind" text not null,
      "name" text not null,
      "description" text not null default '',
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("id", "organizationId")
    )
  `.execute(db)
  await sql`
    create index "elementsOrgKindIdx" on "elements" ("organizationId", "kind")
  `.execute(db)
  await sql`
    create index "elementsOrgUpdatedIdx"
      on "elements" ("organizationId", "updatedAt" desc, "id" desc)
  `.execute(db)

  await sql`
    create table "elementReferences" (
      "organizationId" text not null references "organization"("id") on delete cascade,
      "elementId" text not null,
      "assetId" text not null,
      "sortOrder" smallint not null default 0,
      "createdAt" timestamptz not null default now(),
      primary key ("elementId", "assetId"),
      foreign key ("elementId", "organizationId")
        references "elements" ("id", "organizationId") on delete cascade,
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId") on delete cascade
    )
  `.execute(db)
  await sql`
    create index "elementReferencesAssetIdx" on "elementReferences" ("assetId")
  `.execute(db)
  await sql`
    create index "elementReferencesOrderIdx"
      on "elementReferences" ("organizationId", "elementId", "sortOrder", "assetId")
  `.execute(db)

  // Historical elementId values from the dropped experiment cannot reference
  // the new table; clear them before re-pointing the provenance constraint.
  await sql`
    update "generationJobSources" set "elementId" = null
    where "elementId" is not null
  `.execute(db)
  await sql`
    alter table "generationJobSources"
      add constraint "generationJobSourcesElementFk"
      foreign key ("elementId", "organizationId")
      references "elements" ("id", "organizationId")
      on delete set null ("elementId")
  `.execute(db)
}

/** Drops the simplified tables; the retired schema is not restored. */
export async function down(db: Kysely<unknown>) {
  // The dropped experiment tables and their rows cannot be reconstructed.
  await sql`
    alter table "generationJobSources"
      drop constraint if exists "generationJobSourcesElementFk"
  `.execute(db)
  await sql`drop table if exists "elementReferences"`.execute(db)
  await sql`drop index if exists "elementsOrgKindIdx"`.execute(db)
  await sql`drop index if exists "elementsOrgUpdatedIdx"`.execute(db)
  await sql`drop table if exists "elements"`.execute(db)
}
