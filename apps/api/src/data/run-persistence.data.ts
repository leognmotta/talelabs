import type {
  Database,
  FlowRunNodeItemTable,
  FlowRunNodeTable,
  GenerationJobInputTable,
  GenerationJobSourceTable,
  GenerationJobTable,
  Transaction,
} from '@talelabs/db'
import type { Insertable } from 'kysely'

const RUN_INSERT_CHUNK_SIZE = 200

export function chunkRunRows<T>(values: readonly T[]) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += RUN_INSERT_CHUNK_SIZE)
    result.push(values.slice(index, index + RUN_INSERT_CHUNK_SIZE))
  return result
}

/** Persists one admitted execution graph with bounded PostgreSQL statements. */
export async function insertRunExecutionRows(input: {
  inputs: readonly Insertable<GenerationJobInputTable>[]
  items: readonly Insertable<FlowRunNodeItemTable>[]
  jobs: readonly Insertable<GenerationJobTable>[]
  nodes: readonly Insertable<FlowRunNodeTable>[]
  sources: readonly Insertable<GenerationJobSourceTable>[]
  trx: Transaction<Database>
}) {
  for (const values of chunkRunRows(input.nodes))
    await input.trx.insertInto('flowRunNodes').values(values).execute()
  for (const values of chunkRunRows(input.items))
    await input.trx.insertInto('flowRunNodeItems').values(values).execute()
  for (const values of chunkRunRows(input.jobs))
    await input.trx.insertInto('generationJobs').values(values).execute()
  for (const values of chunkRunRows(input.sources))
    await input.trx.insertInto('generationJobSources').values(values).execute()
  for (const values of chunkRunRows(input.inputs))
    await input.trx.insertInto('generationJobInputs').values(values).execute()
}
