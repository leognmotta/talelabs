/** Admits self-describing structured-prompt generation job payloads. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Extends immutable generation-job request validation through payload v4. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      drop constraint "generationJobsRequestPayloadCheck",
      add constraint "generationJobsRequestPayloadCheck"
        check (
          jsonb_typeof("requestPayload") = 'object'
          and ("requestPayload" ->> 'requestPayloadVersion')
            in ('0', '1', '2', '3', '4')
        )
  `.execute(db)
}

/** Request-payload migrations are intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
