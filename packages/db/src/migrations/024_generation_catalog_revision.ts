/** Renames generation provenance to the content-sensitive catalog identity. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Migrates generation-job provenance and admits current request payloads. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      rename column "modelRegistryVersion" to "catalogRevision"
  `.execute(db)
  await sql`
    alter table "generationJobs"
      drop constraint "generationJobsRequestPayloadCheck",
      add constraint "generationJobsRequestPayloadCheck"
        check (
          jsonb_typeof("requestPayload") = 'object'
          and ("requestPayload" ->> 'requestPayloadVersion')
            in ('0', '1', '2', '3')
        )
  `.execute(db)
}

/** Catalog provenance migrations are intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
