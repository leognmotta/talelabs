/**
 * Adds M8 billing, append-only credit accounting, run settlement, and the
 * organization storage projection without rewriting historical migrations.
 */

import type { Kysely } from 'kysely'

import { createBillingCommerceSchema } from '../migration-support/billing-commerce.js'
import { createCreditAccountingSchema } from '../migration-support/credit-accounting.js'

/** Creates the complete forward-only M8 billing persistence foundation. */
export async function up(db: Kysely<unknown>) {
  await createBillingCommerceSchema(db)
  await createCreditAccountingSchema(db)
}

/** M8 billing persistence is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
