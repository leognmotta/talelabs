import type { Database } from './schema.js'

import type { Kysely, Transaction } from 'kysely'

import { sql } from 'kysely'

export const MAX_FOLDER_DEPTH = 32
export const MAX_FOLDERS_PER_ORGANIZATION = 500
export const FLOW_OUTPUTS_ROOT_FOLDER_NAME = 'Flow'
export const FLOW_OUTPUTS_ROOT_SYSTEM_ROLE = 'flows_root'

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
