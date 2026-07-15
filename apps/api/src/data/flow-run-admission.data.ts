import type { Database, Transaction } from '@talelabs/db'

import { sql } from '@talelabs/db'

/** Serializes every new run admission for one organization before limits run. */
export async function acquireFlowRunAdmissionLocks(
  trx: Transaction<Database>,
  organizationId: string,
  idempotencyKey: string,
) {
  await sql`
    select pg_advisory_xact_lock(
      hashtext(${organizationId}),
      hashtext('flow-run-admission')
    )
  `.execute(trx)
  await sql`
    select pg_advisory_xact_lock(
      hashtext(${organizationId}),
      hashtext(${idempotencyKey})
    )
  `.execute(trx)
}
