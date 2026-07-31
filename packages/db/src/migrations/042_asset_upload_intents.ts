/**
 * Adds durable direct-upload quota reservations and abandoned-object cleanup
 * without rewriting previously applied billing migrations.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Prevents signed direct uploads from bypassing organization storage quotas. */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table "assetUploadIntents" (
      "id" text primary key,
      "organizationId" text not null
        references "organization" ("id") on delete cascade,
      "userId" text not null,
      "objectKey" text not null unique,
      "filename" text not null,
      "mimeType" text not null,
      "sizeBytes" bigint not null check ("sizeBytes" > 0),
      "checksumMd5" text not null,
      "status" text not null default 'pending'
        check ("status" in ('pending', 'registered', 'expired', 'canceled')),
      "expiresAt" timestamptz not null,
      "assetId" text,
      "reservationReleasedAt" timestamptz,
      "registeredAt" timestamptz,
      "objectDeletedAt" timestamptz,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique ("organizationId", "assetId"),
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId"),
      check ("expiresAt" > "createdAt"),
      check (
        (
          "status" = 'pending'
          and "assetId" is null
          and "reservationReleasedAt" is null
          and "registeredAt" is null
          and "objectDeletedAt" is null
        )
        or (
          "status" = 'registered'
          and "assetId" is not null
          and "reservationReleasedAt" is not null
          and "registeredAt" is not null
          and "objectDeletedAt" is null
        )
        or (
          "status" = 'expired'
          and "assetId" is null
          and "registeredAt" is null
          and (
            (
              "reservationReleasedAt" is null
              and "objectDeletedAt" is null
            )
            or (
              "reservationReleasedAt" is not null
              and "objectDeletedAt" is not null
            )
          )
        )
        or (
          "status" = 'canceled'
          and "assetId" is null
          and "reservationReleasedAt" is not null
          and "registeredAt" is null
          and "objectDeletedAt" is not null
        )
      )
    )
  `.execute(db)

  await sql`
    create index "assetUploadIntentsOrgStatusIdx"
      on "assetUploadIntents" ("organizationId", "status", "expiresAt", "id")
  `.execute(db)

  await sql`
    create index "assetUploadIntentsCleanupIdx"
      on "assetUploadIntents" ("expiresAt", "id")
      where
        "status" in ('pending', 'expired')
        and "objectDeletedAt" is null
  `.execute(db)
}

/** Direct-upload quota reservations are intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
