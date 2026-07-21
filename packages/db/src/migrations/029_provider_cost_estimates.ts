/** Persists immutable admission-time provider-cost evidence per generation job. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds the nullable JSONB quote without rewriting historical generation rows. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      add column "providerCostEstimate" jsonb
  `.execute(db)
}

/** Removes the advisory quote column without affecting actual-cost settlement. */
export async function down(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      drop column if exists "providerCostEstimate"
  `.execute(db)
}
