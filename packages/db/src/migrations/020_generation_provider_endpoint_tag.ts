import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Persists exact provider endpoint selection for newly admitted jobs. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      add column "providerEndpointTag" text,
      add constraint "generationJobs_provider_endpoint_tag_check"
        check (
          "providerEndpointTag" is null
          or length(trim("providerEndpointTag")) > 0
        )
  `.execute(db)
}

/** Provider provenance migrations are intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
