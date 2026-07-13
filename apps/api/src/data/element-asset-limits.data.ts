import type { Database } from '@talelabs/db'
import type { Transaction } from 'kysely'

import { sql } from '@talelabs/db'
import { ELEMENT_SOURCE_CAPACITY } from '@talelabs/elements'

export interface ElementAssetLimitViolation {
  maximum: number
  role: string
}

/**
 * Lock hierarchy for Element link mutations:
 *
 * Flow-reference budget -> folder structure (when applicable) -> Element ->
 * role -> existing Asset.
 *
 * The Element-level advisory lock serializes the element-wide source cap. When
 * both Element and role locks are needed, acquire the Element lock first. Role
 * locks are acquired in sorted order when more than one role is involved. An
 * existing Asset row is locked last so permanent deletion cannot race an
 * attachment or relationship update without reversing this hierarchy.
 */
export async function lockElementAssetSources(
  trx: Transaction<Database>,
  input: {
    elementId: string
    organizationId: string
  },
) {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(
        ${`talelabs:element-assets:${input.organizationId}:${input.elementId}`},
        0
      )
    )
  `.execute(trx)
}

/** Serializes master-capacity checks for one tenant-owned Element role. */
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

/** Checks master role capacity after `lockElementAssetRole` was acquired. */
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
    .where('referenceKind', '=', 'master')
    .executeTakeFirstOrThrow()

  return Number(result.count) >= input.maximum
    ? { maximum: input.maximum, role: input.role }
    : null
}

/** Checks the element-wide source cap after `lockElementAssetSources`. */
export async function hasElementSourceCapacityViolation(
  trx: Transaction<Database>,
  input: {
    elementId: string
    organizationId: string
  },
) {
  const result = await trx.selectFrom('elementAssets')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('elementId', '=', input.elementId)
    .where('referenceKind', '=', 'source')
    .executeTakeFirstOrThrow()

  return Number(result.count) >= ELEMENT_SOURCE_CAPACITY
}
