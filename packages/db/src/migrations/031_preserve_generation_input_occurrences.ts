/** Preserves repeated Asset occurrences in immutable provider input order. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Admits request v5 and keys exact inputs by their ordered occurrence. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobInputs"
      drop constraint "generationJobInputs_pkey",
      drop constraint "generationJobInputs_jobId_sortOrder_key",
      add constraint "generationJobInputs_pkey"
        primary key ("jobId", "sortOrder")
  `.execute(db)
  await sql`
    alter table "generationJobs"
      drop constraint "generationJobsRequestPayloadCheck",
      add constraint "generationJobsRequestPayloadCheck"
        check (
          jsonb_typeof("requestPayload") = 'object'
          and ("requestPayload" ->> 'requestPayloadVersion')
            in ('0', '1', '2', '3', '4', '5')
        )
  `.execute(db)
}

/** Input-occurrence and request-version migrations are forward-only. */
export async function down(_db: Kysely<unknown>) {}
