/**
 * Replaces cleanup branch indexes with one ordered eligibility expression.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Keeps bounded cleanup claims proportional to the requested page size. */
export async function up(db: Kysely<unknown>) {
  await sql`
    create index "assetUploadIntentsCleanupEligibilityIdx"
      on "assetUploadIntents" (
        (coalesce("cleanupNextAt", "expiresAt")),
        "id"
      )
      where
        "status" in ('pending', 'expired')
        and "objectDeletedAt" is null
  `.execute(db)

  await sql`
    drop index "assetUploadIntentsCleanupPendingIdx"
  `.execute(db)

  await sql`
    drop index "assetUploadIntentsCleanupRetryIdx"
  `.execute(db)
}

/** Direct-upload cleanup indexing is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
