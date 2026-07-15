import type { Database } from '@talelabs/db'
import type {
  FlowRunSnapshotExecutionContract,
  PlannedJobRequestPayload,
} from '@talelabs/flows'
import type { Kysely } from 'kysely'

import { readFlowRunSnapshotExecutionContract } from '@talelabs/flows'
import { sql } from 'kysely'

interface ContractJob {
  adapterVersion: string
  model: string
  modelRegistryVersion: string
  nodeId: string
  operation: string
  provider: string
  providerModel: string
  providerRouteVersion: string
  requestIndex: number
}

/** Selects only one bounded contract object instead of transferring the snapshot. */
export async function loadSnapshotExecutionContract(input: {
  database: Kysely<Database>
  flowRunId: string
  nodeId: string
  organizationId: string
}) {
  const result = await sql<{ executionContract: unknown }>`
    select contract.value as "executionContract"
    from "flowRuns" as run
    cross join lateral jsonb_array_elements(
      coalesce(run."graphSnapshot" -> 'executionContracts', '[]'::jsonb)
    ) as contract(value)
    where run."organizationId" = ${input.organizationId}
      and run.id = ${input.flowRunId}
      and contract.value ->> 'nodeId' = ${input.nodeId}
    limit 2
  `.execute(input.database)
  if (result.rows.length !== 1)
    throw new Error('generation_execution_contract_missing_or_ambiguous')
  return readFlowRunSnapshotExecutionContract(
    result.rows[0]!.executionContract,
  )
}

/**
 * Verifies relational job fields and the bounded request against the exact
 * execution contract that was integrity-checked by the parent worker.
 */
export function assertJobMatchesSnapshotExecutionContract(input: {
  contract: FlowRunSnapshotExecutionContract
  job: ContractJob
  requestPayload: PlannedJobRequestPayload
}) {
  const matches = input.contract.adapterVersion === input.job.adapterVersion
    && input.contract.modelContractVersion
    === input.requestPayload.modelContractVersion
    && input.contract.modelId === input.job.model
    && input.contract.modelId === input.requestPayload.modelId
    && input.contract.modelRegistryVersion === input.job.modelRegistryVersion
    && input.contract.nodeId === input.job.nodeId
    && input.contract.nodeId === input.requestPayload.nodeId
    && input.contract.operationId === input.job.operation
    && input.contract.operationId === input.requestPayload.operationId
    && (input.contract.provider === undefined
      || input.contract.provider === input.job.provider)
    && input.contract.providerModel === input.job.providerModel
    && input.contract.providerRouteVersion === input.job.providerRouteVersion
    && input.job.requestIndex === input.requestPayload.requestIndex
  if (!matches)
    throw new Error('generation_execution_contract_mismatch')
}
