/** Shared folder naming, managed-role, limit, and structural-lock contracts. */

import type { Kysely, Transaction } from 'kysely'
import type { Database } from './schema.js'

import { sql } from 'kysely'

/** Maximum supported root-to-leaf folder depth. */
export const MAX_FOLDER_DEPTH = 32
/** Organization-wide bound that keeps the flat folder metadata read finite. */
export const MAX_FOLDERS_PER_ORGANIZATION = 500
/** Stable display name for the managed Private Flow output root. */
export const FLOW_OUTPUTS_ROOT_FOLDER_NAME = 'Flow'
/** Scope-unique role identifying the managed Private Flow output root. */
export const FLOW_OUTPUTS_ROOT_SYSTEM_ROLE = 'flows_root'
/** Stable display name for the managed Private Create output root. */
export const CREATE_OUTPUTS_ROOT_FOLDER_NAME = 'Create'
/** Scope-unique role identifying a managed Create output root. */
export const CREATE_OUTPUTS_ROOT_SYSTEM_ROLE = 'create_root'

/** Returns the scope-unique role for one Flow-owned output folder. */
export function flowOutputFolderSystemRole(flowId: string) {
  return `flow_output:${flowId}`
}

/** Returns the scope-unique role for one Create-session-owned output folder. */
export function createSessionOutputFolderSystemRole(sessionId: string) {
  return `create_output:${sessionId}`
}

/** Returns a case-insensitively unique folder name within one sibling set. */
export function availableFolderName(baseName: string, occupiedNames: string[]) {
  const occupied = new Set(occupiedNames.map(name => name.toLowerCase()))
  if (!occupied.has(baseName.toLowerCase()))
    return baseName

  for (let suffix = 2; ; suffix += 1) {
    const suffixText = ` ${suffix}`
    const candidate = `${baseName.slice(0, 255 - suffixText.length)}${suffixText}`
    if (!occupied.has(candidate.toLowerCase()))
      return candidate
  }
}

/**
 * Serializes structural folder mutations for one organization across API and
 * worker processes. Callers must acquire this before locking a Flow whose
 * output-folder association may be read or changed.
 */
export async function lockFolderStructure(
  executor: Kysely<Database> | Transaction<Database>,
  organizationId: string,
) {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`talelabs:folders:${organizationId}`}, 0)
    )
  `.execute(executor)
}
