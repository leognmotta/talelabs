import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  // Element nodes are outside the MVP graph contract. Removing the node also
  // removes its incident edges through the existing flowEdges foreign keys.
  await sql`
    with deleted as (
      delete from "flowNodes"
      where "type" = 'element'
      returning "flowId"
    )
    update "flows"
    set
      "revision" = "revision" + 1,
      "updatedAt" = now()
    where "id" in (select distinct "flowId" from deleted)
  `.execute(db)

  await sql`
    alter table "flowNodes"
      drop column "elementId"
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  // The relationship can be restored structurally, but deleted graph content
  // cannot be reconstructed safely.
  await sql`
    alter table "flowNodes"
      add column "elementId" text,
      add constraint "flowNodes_elementId_organizationId_fkey"
        foreign key ("elementId", "organizationId")
        references "elements" ("id", "organizationId")
        on delete set null ("elementId")
  `.execute(db)

  await sql`
    create index "flowNodesElementIdx" on "flowNodes" ("elementId")
      where "elementId" is not null
  `.execute(db)
}
