/** Same-run input materialization and immutable source/input provenance writes. */

import type {
  DatabaseExecutor,
  GenerationJobInputTable,
  GenerationJobSourceTable,
} from '@talelabs/db'
import type {
  CompiledGenerationJobInput,
  GenerationJobRequestInput,
  PlannedJobRequestInput,
  PlannedJobRequestPayload,
} from '@talelabs/flows'
import type { Insertable } from 'kysely'

import { createId } from '@paralleldrive/cuid2'
import { db, withDatabaseTransaction } from '@talelabs/db'
import {
  generationJobExecutionStepId,
  generationJobInputBindingId,
  generationJobInputTargetSlotId,
  materializeGenerationProviderRequest,
  selectedProviderRequestInputs,
} from '@talelabs/flows'

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
  const sourceIdByAssetLocation = new Map<string, string>()
  const sourceRows: Insertable<GenerationJobSourceTable>[] = []
  const materializedRequestInputs: GenerationJobRequestInput[] = []

  for (const plannedInput of input.requestPayload.inputs) {
    const bindingId = generationJobInputBindingId(plannedInput)
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
        nodeId: sourceId,
        organizationId: input.organizationId,
        resolvedText: text,
        snapshot: materializedItem as unknown as GenerationJobSourceTable['snapshot'],
        sortOrder,
        sourceType,
      })

      for (const assetRef of assetRefs) {
        if (!('assetId' in assetRef))
          continue
        sourceIdByAssetLocation.set(
          `${bindingId}\u0000${runtimeItem.key}\u0000${assetRef.assetId}`,
          sourceId,
        )
      }
      sortOrder += 1
    }
    materializedRequestInputs.push({ ...plannedInput, items: materializedItems })
  }

  const materializedRequestPayload: PlannedJobRequestPayload
    = input.requestPayload.requestPayloadVersion === 6
      ? {
          ...input.requestPayload,
          inputs: materializedRequestInputs as CompiledGenerationJobInput[],
        }
      : {
          ...input.requestPayload,
          inputs: materializedRequestInputs as PlannedJobRequestInput[],
        }
  const providerRequest = materializeGenerationProviderRequest({
    requestId: input.jobId,
    requestPayload: materializedRequestPayload,
  })
  const promptSlot = providerRequest.textSlots.find(slot => slot.slotId === 'prompt')

  if (input.requestPayload.promptTemplates?.prompt && promptSlot?.source === 'inline') {
    sourceRows.push({
      assetId: null,
      elementId: null,
      id: createId(),
      jobId: input.jobId,
      nodeId: generationJobExecutionStepId(input.requestPayload),
      organizationId: input.organizationId,
      resolvedText: promptSlot.resolvedText,
      snapshot: {
        kind: 'promptTemplate',
        references: promptSlot.inputReferences,
        resolvedText: promptSlot.resolvedText,
        template: input.requestPayload.promptTemplates.prompt,
      } as unknown as GenerationJobSourceTable['snapshot'],
      sortOrder,
      sourceType: 'text',
    })
    sortOrder += 1
  }

  const inputRows: Insertable<GenerationJobInputTable>[] = []
  for (const plannedInput of selectedProviderRequestInputs(materializedRequestPayload)) {
    const bindingId = generationJobInputBindingId(plannedInput)
    const role = generationJobInputTargetSlotId(plannedInput) || 'reference'
    for (const runtimeItem of plannedInput.items) {
      for (const assetRef of assetReferencesFromValue(runtimeItem.value)) {
        if (!('assetId' in assetRef))
          continue
        inputRows.push({
          assetId: assetRef.assetId,
          jobId: input.jobId,
          organizationId: input.organizationId,
          role,
          sortOrder: inputSortOrder,
          sourceId: sourceIdByAssetLocation.get(
            `${bindingId}\u0000${runtimeItem.key}\u0000${assetRef.assetId}`,
          ) ?? null,
        })
        inputSortOrder += 1
      }
    }
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
    await trx.updateTable('generationJobs')
      .set({ resolvedPrompt: promptSlot?.resolvedText ?? null })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.jobId)
      .execute()
  })

  logRunEngine('info', 'generation_job.inputs.materialized', {
    generationJobId: input.jobId,
    inputAssetCount: inputRows.length,
    organizationId: input.organizationId,
    sourceCount: sortOrder,
    runId: input.flowRunId,
  })
  return materializedRequestPayload
}
