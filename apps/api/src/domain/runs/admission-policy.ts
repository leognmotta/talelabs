/**
 * Source-neutral durable run admission guards.
 *
 * Flow and direct Create admission share runtime/funding compatibility and the
 * same tenant-wide active-run capacity.
 */

import type { Database, Transaction } from '@talelabs/db'

import { BROWSER_EXECUTION_ENABLED, FLOW_RUN_LIMITS } from '@talelabs/flows'

import { HttpError } from '../../middleware/error.js'

/** Rejects an unavailable runtime or incompatible funding/runtime pair. */
export function assertRunRuntimePolicy(input: {
  /** Environment responsible for provider lifecycle work. */
  executionRuntime: 'browser' | 'managed'
  /** Account source responsible for provider spend. */
  fundingSource: 'byok' | 'credits'
}) {
  if (input.executionRuntime === 'browser' && !BROWSER_EXECUTION_ENABLED) {
    throw new HttpError(
      409,
      'invalid_execution_runtime',
      'Browser execution is unavailable.',
    )
  }
  if (
    (input.fundingSource === 'credits' && input.executionRuntime !== 'managed')
    || (input.fundingSource === 'byok' && input.executionRuntime !== 'browser')
  ) {
    throw new HttpError(
      409,
      'invalid_execution_runtime',
      'The selected funding source is unavailable for this execution runtime.',
    )
  }
}

/** Enforces the existing tenant-wide active durable-run admission limit. */
export async function assertRunAdmissionCapacity(input: {
  /** Tenant whose active runs are counted across every source. */
  organizationId: string
  /** Admission transaction holding the tenant advisory lock. */
  trx: Transaction<Database>
}) {
  const activeRunCount = await input.trx.selectFrom('flowRuns')
    .select(eb => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', input.organizationId)
    .where('status', 'in', ['pending', 'running'])
    .executeTakeFirst()
  if (
    Number(activeRunCount?.count ?? 0)
    < FLOW_RUN_LIMITS.organizationActiveRuns
  ) {
    return
  }
  throw new HttpError(
    429,
    'organization_run_capacity_exceeded',
    'This organization has too many active runs.',
    [{
      code: 'organization_run_capacity_exceeded',
      field: 'organizationId',
      message: 'organization_run_capacity_exceeded',
      params: { maximum: FLOW_RUN_LIMITS.organizationActiveRuns },
    }],
  )
}
