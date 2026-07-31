/** Concurrent disposable-database verification for credit-grant idempotency. */

import type { Kysely } from 'kysely'
import type { Database } from '../src/schema.js'

import { invariant } from './billing-verifier-support.js'

/** Appends one same-key grant concurrently and returns its durable identity. */
export async function verifyConcurrentCreditGrant(
  database: Kysely<Database>,
  accounting: typeof import('../src/index.js'),
  catalogRevision: string,
) {
  const input = {
    catalogRevision,
    createdBy: 'billing-verifier-user',
    idempotencyKey: 'grant:concurrency',
    offerCode: null,
    organizationId: 'billing-org-a',
    originalCredits: 100,
    outputPolicy: {
      outputVisibility: 'private' as const,
      showcaseEligible: false,
    },
    planCode: null,
    source: 'manual' as const,
  }
  const results = await Promise.all([
    accounting.appendCreditGrant(input, database),
    accounting.appendCreditGrant(input, database),
  ])
  const created = results.filter(result => !result.replayed)
  const replayed = results.filter(result => result.replayed)
  invariant(
    created.length === 1
    && replayed.length === 1
    && created[0]!.grantId === replayed[0]!.grantId,
    'concurrent_grant_idempotency',
  )
  return created[0]!
}
