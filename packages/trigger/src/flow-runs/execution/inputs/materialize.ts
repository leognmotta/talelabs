/** Same-run input materialization and immutable source/input provenance writes. */

import type {
  DatabaseExecutor,
  GenerationJobInputTable,
  GenerationJobSourceTable,
} from '@talelabs/db'
import type {
  PlannedJobRequestInput,
  PlannedJobRequestPayload,
} from '@talelabs/flows'
import type { Insertable } from 'kysely'

import { createId } from '@paralleldrive/cuid2'
import { db, withDatabaseTransaction } from '@talelabs/db'

import { logRunEngine } from '../../observability/logging.js'
import {
  assetReferencesFromValue,
  materializeRuntimeValue,
} from './runtime-value.js'

/** Resolves same-run placeholders and persists exact source/input provenance. */
export async function materializeJobInputs(
  input: {
    flowRunId: string
    jobId: string
    organizationId: string
    requestPayload: PlannedJobRequestPayload
  },
  database: DatabaseExecutor = db,
): Promise<PlannedJobRequestPayload> {
  let sortOrder = 0
  let inputSortOrder = 0
  const insertedInputKeys = new Set<string>()
  const sourceRows: Insertable<GenerationJobSourceTable>[] = []
  const inputRows: Insertable<GenerationJobInputTable>[] = []
  const materializedRequestInputs: PlannedJobRequestInput[] = []

  for (const plannedInput of input.requestPayload.inputs) {
    const materializedItems = []
    for (const runtimeItem of plannedInput.items) {
      const materializedValue = await materializeRuntimeValue({
        flowRunId: input.flowRunId,
        organizationId: input.organizationId,
        value: runtimeItem.value,
      }, database)
      const materializedItem = { ...runtimeItem, value: materializedValue }
      materializedItems.push(materializedItem)
      const sourceId = createId()
      const assetRefs = assetReferencesFromValue(materializedValue)
      const text = materializedValue.kind === 'text' ? materializedValue.text : null
      const firstAsset = assetRefs[0]
      const origin = materializedValue.kind === 'text'
        ? materializedValue.origin
        : undefined
      const sourceType = firstAsset
        ? firstAsset.source === 'staticAsset' ? 'asset' : 'nodeOutput'
        : origin?.source === 'priorOutput' || origin?.source === 'sameRunOutput'
          ? 'nodeOutput'
          : 'text'
      sourceRows.push({
        assetId: firstAsset && 'assetId' in firstAsset ? firstAsset.assetId : null,
        elementId: null,
        id: sourceId,
        jobId: input.jobId,
        nodeId: plannedInput.sourceNodeId,
        organizationId: input.organizationId,
        resolvedText: text,
        snapshot: materializedItem as unknown as GenerationJobSourceTable['snapshot'],
        sortOrder,
        sourceType,
      })

      const role = plannedInput.targetHandleId || 'reference'

      for (const assetRef of assetRefs) {
        if (!('assetId' in assetRef))
          continue
        const inputKey = `${assetRef.assetId}\u0000${role}`
        if (insertedInputKeys.has(inputKey))
          continue
        insertedInputKeys.add(inputKey)
        inputRows.push({
          assetId: assetRef.assetId,
          jobId: input.jobId,
          organizationId: input.organizationId,
          role,
          sortOrder: inputSortOrder,
          sourceId,
        })
        inputSortOrder += 1
      }
      sortOrder += 1
    }
    materializedRequestInputs.push({ ...plannedInput, items: materializedItems })
  }

  await withDatabaseTransaction(database, async (trx) => {
    await trx.deleteFrom('generationJobInputs')
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .execute()
    await trx.deleteFrom('generationJobSources')
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .execute()
    if (sourceRows.length > 0)
      await trx.insertInto('generationJobSources').values(sourceRows).execute()
    if (inputRows.length > 0)
      await trx.insertInto('generationJobInputs').values(inputRows).execute()
  })

  logRunEngine('info', 'generation_job.inputs.materialized', {
    generationJobId: input.jobId,
    inputAssetCount: insertedInputKeys.size,
    organizationId: input.organizationId,
    sourceCount: sortOrder,
    runId: input.flowRunId,
  })
  return { ...input.requestPayload, inputs: materializedRequestInputs }
}
