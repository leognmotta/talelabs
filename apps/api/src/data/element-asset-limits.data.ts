import type { Database } from '@talelabs/db'
import type { Transaction } from 'kysely'

import { sql } from '@talelabs/db'

export interface ElementAssetLimitViolation {
  maximum: number
  role: string
}

/** Serializes capacity checks for one tenant-owned Element role. */
export async function lockElementAssetRole(
  trx: Transaction<Database>,
  input: {
    elementId: string
    organizationId: string
    role: string
  },
) {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(
        ${`talelabs:element-assets:${input.organizationId}:${input.elementId}:${input.role}`},
        0
      )
    )
  `.execute(trx)
}

/** Checks role capacity after `lockElementAssetRole` has been acquired. */
export async function findElementAssetRoleCapacityViolation(
  trx: Transaction<Database>,
  input: {
    elementId: string
    maximum: number
    organizationId: string
    role: string
  },
): Promise<ElementAssetLimitViolation | null> {
  const result = await trx.selectFrom('elementAssets')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('elementId', '=', input.elementId)
    .where('role', '=', input.role)
    .executeTakeFirstOrThrow()

  return Number(result.count) >= input.maximum
    ? { maximum: input.maximum, role: input.role }
    : null
}
