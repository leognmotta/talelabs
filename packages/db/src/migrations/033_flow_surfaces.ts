/** Adds the presentation-only surface discriminator to ordinary Flow identities. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Backfills canvas ownership and adds the tenant-scoped surface browse index. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flows"
      add column "surface" text
  `.execute(db)

  await sql`
    update "flows"
    set "surface" = 'canvas'
    where "surface" is null
  `.execute(db)

  await sql`
    alter table "flows"
      alter column "surface" set default 'canvas',
      alter column "surface" set not null,
      add constraint "flowsSurfaceCheck"
        check ("surface" in ('canvas', 'create'))
  `.execute(db)

  await sql`drop index "flowsOrgUpdatedIdx"`.execute(db)
  await sql`
    create index "flowsOrgSurfaceUpdatedIdx"
      on "flows" (
        "organizationId",
        "surface",
        "updatedAt" desc,
        "id" desc
      )
  `.execute(db)
}

/** Flow surface identity is forward-only because newer clients require it. */
export async function down(_db: Kysely<unknown>) {}
