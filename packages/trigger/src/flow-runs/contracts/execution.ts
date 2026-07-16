/** Bounded snapshot-contract loading and generation-job identity verification. */

import type { Database } from '@talelabs/db'
import type {
  FlowRunSnapshotExecutionContract,
  PlannedJobRequestPayload,
} from '@talelabs/flows'
import type { Kysely } from 'kysely'

import {
  generationProviderLifecyclesEqual,
  readFlowRunExecutionMode,
  readFlowRunSnapshotExecutionContract,
} from '@talelabs/flows'
import { sql } from 'kysely'

interface ContractJob {
  adapterVersion: string
  catalogRevision: string
  model: string
  nodeId: string
  operation: string
  provider: string
  providerEndpoint: null | string
  providerEndpointTag: null | string
  providerLifecycle: unknown
  providerModel: string
  providerRouteVersion: string
  requestIndex: number
}

/** Selects only one bounded contract object instead of transferring the snapshot. */
export async function loadSnapshotExecutionContext(input: {
  database: Kysely<Database>
  flowRunId: string
  nodeId: string
  organizationId: string
}) {
  const result = await sql<{
    executionContract: unknown
    executionMode: unknown
  }>`
    select
      contract.value as "executionContract",
      run."graphSnapshot" ->> 'executionMode' as "executionMode"
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
  return {
    contract: readFlowRunSnapshotExecutionContract(
      result.rows[0]!.executionContract,
    ),
    executionMode: readFlowRunExecutionMode(
      result.rows[0]!.executionMode ?? undefined,
    ),
  }
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
    && input.contract.catalogRevision === input.job.catalogRevision
    && input.contract.catalogRevision === input.requestPayload.catalogRevision
    && input.contract.catalogVersion === input.requestPayload.catalogVersion
    && input.contract.modelContractVersion
    === input.requestPayload.modelContractVersion
    && input.contract.modelId === input.job.model
    && input.contract.modelId === input.requestPayload.modelId
    && input.contract.modelRevision === input.requestPayload.modelRevision
    && input.contract.nodeId === input.job.nodeId
    && input.contract.nodeId === input.requestPayload.nodeId
    && input.contract.operationId === input.job.operation
    && input.contract.operationId === input.requestPayload.operationId
    && input.contract.provider === input.job.provider
    && input.contract.providerEndpoint === input.job.providerEndpoint
    && input.contract.providerEndpointTag === input.job.providerEndpointTag
    && generationProviderLifecyclesEqual(
      input.contract.providerLifecycle,
      input.job.providerLifecycle,
    )
    && input.contract.providerModel === input.job.providerModel
    && input.contract.providerRouteVersion === input.job.providerRouteVersion
    && input.contract.providerBinding.adapterVersion === input.job.adapterVersion
    && input.contract.providerBinding.endpoint === input.job.providerEndpoint
    && input.contract.providerBinding.nativeModelId === input.job.providerModel
    && input.contract.providerBinding.operationId === input.job.operation
    && input.contract.providerBinding.provider === input.job.provider
    && input.contract.providerBinding.providerTag === input.job.providerEndpointTag
    && input.contract.providerBinding.routeVersion === input.job.providerRouteVersion
    && input.job.requestIndex === input.requestPayload.requestIndex
  if (!matches)
    throw new Error('generation_execution_contract_mismatch')
}
