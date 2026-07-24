/**
 * Repairs Project covers that still reference an Asset already queued for
 * permanent purge before purge-time cover cleanup was introduced.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Clears stale cover references and records the resulting Project mutation. */
export async function up(db: Kysely<unknown>) {
  await sql`
    update "projects" project
    set
      "coverAssetId" = null,
      "updatedAt" = now()
    from "assets" asset
    where project."organizationId" = asset."organizationId"
      and project."coverAssetId" = asset."id"
      and asset."purgeRequestedAt" is not null
  `.execute(db)
}

/** Purge repair is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
