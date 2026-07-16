import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds immutable provider execution facts; historical jobs stay valid. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      add column "providerEndpoint" text,
      add column "providerGenerationId" text,
      add column "providerLifecycle" jsonb,
      add constraint "generationJobs_provider_submission_lifecycle_check"
        check (
          "providerJobId" is null
          or "providerSubmittedAt" is not null
        ),
      add constraint "generationJobs_openrouter_contract_check"
        check (
          "provider" <> 'openrouter'
          or (
            "providerEndpoint" is not null
            and "providerLifecycle" is not null
          )
        )
  `.execute(db)
}

/** This production provenance migration is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
