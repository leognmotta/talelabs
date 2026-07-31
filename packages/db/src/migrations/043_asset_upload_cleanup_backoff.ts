/**
 * Adds durable retry eligibility and crash-safe leases to direct-upload cleanup.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Prevents persistent cleanup failures from starving later upload intents. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "assetUploadIntents"
      add column "cleanupAttemptCount" integer not null default 0
        check ("cleanupAttemptCount" >= 0),
      add column "cleanupAttemptedAt" timestamptz,
      add column "cleanupLastErrorCode" text,
      add column "cleanupLastFailedAt" timestamptz,
      add column "cleanupNextAt" timestamptz
  `.execute(db)

  await sql`
    update "assetUploadIntents"
      set "cleanupNextAt" = now()
      where
        "status" = 'expired'
        and "objectDeletedAt" is null
  `.execute(db)

  await sql`
    alter table "assetUploadIntents"
      add constraint "assetUploadIntentsCleanupFailureShape"
        check (
          (
            "cleanupLastErrorCode" is null
            and "cleanupLastFailedAt" is null
          )
          or (
            "cleanupLastErrorCode" is not null
            and "cleanupLastFailedAt" is not null
          )
        ),
      add constraint "assetUploadIntentsCleanupEligibilityShape"
        check (
          (
            "status" = 'expired'
            and "objectDeletedAt" is null
            and "cleanupNextAt" is not null
          )
          or (
            (
              "status" <> 'expired'
              or "objectDeletedAt" is not null
            )
            and "cleanupNextAt" is null
          )
        )
  `.execute(db)

  await sql`
    drop index "assetUploadIntentsCleanupIdx"
  `.execute(db)

  await sql`
    create index "assetUploadIntentsCleanupPendingIdx"
      on "assetUploadIntents" ("expiresAt", "id")
      where
        "status" = 'pending'
        and "objectDeletedAt" is null
  `.execute(db)

  await sql`
    create index "assetUploadIntentsCleanupRetryIdx"
      on "assetUploadIntents" ("cleanupNextAt", "id")
      where
        "status" = 'expired'
        and "objectDeletedAt" is null
  `.execute(db)
}

/** Direct-upload cleanup recovery is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
