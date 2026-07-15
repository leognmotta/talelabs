import type {
  GenerationJobInputTable,
  GenerationJobSourceTable,
} from '@talelabs/db'
import type {
  FlowRuntimeValue,
  PlannedJobRequestInput,
  PlannedJobRequestPayload,
  RuntimeAssetReference,
} from '@talelabs/flows'
import type { Insertable } from 'kysely'

import { createId } from '@paralleldrive/cuid2'
import { db } from '@talelabs/db'

import { logRunEngine } from './logging.js'

function assetReferencesFromValue(value: FlowRuntimeValue) {
  return value.kind === 'text' ? [] : value.assets
}

async function resolveSameRunText(input: {
  flowRunId: string
  itemKey: string
  nodeId: string
  organizationId: string
}) {
  const row = await db.selectFrom('generationJobs as job')
    .innerJoin('generationJobTextOutputs as output', join => join
      .onRef('output.jobId', '=', 'job.id')
      .onRef('output.organizationId', '=', 'job.organizationId'))
    .select(['job.id as generationJobId', 'output.outputIndex', 'output.text'])
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', '=', input.flowRunId)
    .where('job.nodeId', '=', input.nodeId)
    .where('job.itemKey', '=', input.itemKey)
    .where('job.status', '=', 'succeeded')
    .orderBy('job.requestIndex')
    .orderBy('output.outputIndex')
    .executeTakeFirst()

  if (!row)
    throw new Error(`same_run_text_output_missing:${input.nodeId}:${input.itemKey}`)
  return row
}

async function resolveSameRunAsset(input: {
  flowRunId: string
  itemKey: string
  nodeId: string
  organizationId: string
  outputIndex: number
}) {
  const row = await db.selectFrom('generationJobs as job')
    .innerJoin('assets as asset', join => join
      .onRef('asset.generationJobId', '=', 'job.id')
      .onRef('asset.organizationId', '=', 'job.organizationId'))
    .select([
      'asset.id as assetId',
      'asset.outputIndex',
      'asset.type as mediaType',
      'job.id as generationJobId',
    ])
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', '=', input.flowRunId)
    .where('job.nodeId', '=', input.nodeId)
    .where('job.itemKey', '=', input.itemKey)
    .where('job.status', '=', 'succeeded')
    .where('asset.outputIndex', '=', input.outputIndex)
    .where('asset.processingState', '=', 'ready')
    .where('asset.deletedAt', 'is', null)
    .where('asset.purgeRequestedAt', 'is', null)
    .where('asset.purgedAt', 'is', null)
    .orderBy('job.requestIndex')
    .executeTakeFirst()

  if (!row) {
    throw new Error(
      `same_run_asset_output_missing:${input.nodeId}:${input.itemKey}:${input.outputIndex}`,
    )
  }
  return row
}

async function materializeRuntimeValue(input: {
  flowRunId: string
  organizationId: string
  value: FlowRuntimeValue
}): Promise<FlowRuntimeValue> {
  if (input.value.kind === 'text') {
    if (input.value.origin.source !== 'sameRunOutput')
      return input.value
    const text = await resolveSameRunText({
      flowRunId: input.flowRunId,
      itemKey: input.value.origin.itemKey,
      nodeId: input.value.origin.nodeId,
      organizationId: input.organizationId,
    })
    return {
      ...input.value,
      origin: {
        generationJobId: text.generationJobId,
        outputIndex: text.outputIndex,
        source: 'priorOutput',
      },
      text: text.text,
    }
  }

  const assets: RuntimeAssetReference[] = []
  for (const assetRef of input.value.assets) {
    if (assetRef.source !== 'sameRunOutput') {
      assets.push(assetRef)
      continue
    }
    const asset = await resolveSameRunAsset({
      flowRunId: input.flowRunId,
      itemKey: assetRef.itemKey,
      nodeId: assetRef.nodeId,
      organizationId: input.organizationId,
      outputIndex: assetRef.outputIndex,
    })
    if (asset.mediaType === 'document')
      throw new Error('same_run_generated_document_not_supported')
    assets.push({
      assetId: asset.assetId,
      generationJobId: asset.generationJobId,
      mediaType: asset.mediaType,
      outputIndex: asset.outputIndex ?? 0,
      source: 'priorOutput',
    })
  }
  return { ...input.value, assets }
}

/** Resolves same-run placeholders and persists exact source/input provenance. */
export async function materializeJobInputs(input: {
  flowRunId: string
  jobId: string
  organizationId: string
  requestPayload: PlannedJobRequestPayload
}): Promise<PlannedJobRequestPayload> {
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
      })
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

  await db.transaction().execute(async (trx) => {
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
