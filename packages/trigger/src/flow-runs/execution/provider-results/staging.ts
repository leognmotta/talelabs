/** Durable provider-result checkpointing before canonical output finalization. */

import type {
  NormalizedGenerationOutput,
  NormalizedGenerationProviderFacts,
} from '@talelabs/flows'

import { db, sql } from '@talelabs/db'
import { copyObject, putObject, putObjectStream } from '@talelabs/storage'

import { getGeneratedOutputStorageLocation } from '../../../assets/outputs/generated-storage.js'
import { completedProviderSettlement } from './settlement.js'

/** Stages a complete provider result before any Asset finalization can fail. */
export async function stageGenerationProviderResult(input: {
  facts: NormalizedGenerationProviderFacts
  jobId: string
  organizationId: string
  outputs: readonly NormalizedGenerationOutput[]
}) {
  const settledAt = new Date()
  const settlement = completedProviderSettlement(input.facts, settledAt)
  const outputs = [...input.outputs].toSorted(
    (left, right) => left.outputIndex - right.outputIndex,
  )
  const descriptors = outputs.map((output) => {
    if (output.payload.delivery === 'text') {
      return {
        delivery: 'text' as const,
        mediaType: output.mediaType,
        metadata: output.metadata ? { ...output.metadata } : {},
        outputIndex: output.outputIndex,
        text: output.payload.text,
      }
    }
    if (
      output.payload.delivery !== 'bytes'
      && output.payload.delivery !== 'stream'
      && output.payload.delivery !== 'storage'
    ) {
      throw new Error('generation_provider_output_not_checkpointable')
    }
    const storage = getGeneratedOutputStorageLocation({
      generationJobId: input.jobId,
      organizationId: input.organizationId,
      outputIndex: output.outputIndex,
    })
    return {
      delivery: 'storage' as const,
      mediaType: output.mediaType,
      metadata: output.metadata ? { ...output.metadata } : {},
      mimeType: output.payload.mimeType,
      outputIndex: output.outputIndex,
      storageBucket: storage.bucket,
      storageKey: storage.key,
    }
  })

  await db.transaction().execute(async (trx) => {
    const runningJob = await trx.updateTable('generationJobs')
      .set({
        providerCompletionReceivedAt: settledAt,
        providerCompletionStatus: 'completed',
        ...(input.facts.providerCostUsd === undefined
          ? {}
          : { providerCostUsd: String(input.facts.providerCostUsd) }),
        ...(input.facts.providerGenerationId === undefined
          ? {}
          : { providerGenerationId: input.facts.providerGenerationId }),
        ...settlement,
        status: 'running',
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.jobId)
      .where('status', '=', 'running')
      .where('providerSettlementStatus', 'in', [
        'pending',
        'settled',
        'unknown',
      ])
      .returning('id')
      .executeTakeFirst()
    if (!runningJob)
      throw new Error('generation_provider_checkpoint_job_not_running')

    await trx.insertInto('generationProviderResults')
      .values({
        expectedOutputCount: outputs.length,
        jobId: input.jobId,
        organizationId: input.organizationId,
        providerCostUsd: input.facts.providerCostUsd === undefined
          ? null
          : String(input.facts.providerCostUsd),
        providerGenerationId: input.facts.providerGenerationId ?? null,
      })
      .onConflict(conflict => conflict.column('jobId').doUpdateSet({
        providerCostUsd: sql`coalesce(
          "generationProviderResults"."providerCostUsd",
          excluded."providerCostUsd"
        )`,
        providerGenerationId: sql`coalesce(
          "generationProviderResults"."providerGenerationId",
          excluded."providerGenerationId"
        )`,
      }))
      .execute()

    for (const descriptor of descriptors) {
      await trx.insertInto('generationProviderOutputs')
        .values({
          delivery: descriptor.delivery,
          jobId: input.jobId,
          mediaType: descriptor.mediaType,
          metadata: descriptor.metadata,
          mimeType: descriptor.delivery === 'storage'
            ? descriptor.mimeType
            : null,
          organizationId: input.organizationId,
          outputIndex: descriptor.outputIndex,
          status: descriptor.delivery === 'text' ? 'ready' : 'staging',
          storageBucket: descriptor.delivery === 'storage'
            ? descriptor.storageBucket
            : null,
          storageKey: descriptor.delivery === 'storage'
            ? descriptor.storageKey
            : null,
          text: descriptor.delivery === 'text' ? descriptor.text : null,
        })
        .onConflict(conflict => conflict
          .columns(['jobId', 'outputIndex'])
          .doNothing())
        .execute()
    }
  })

  const existing = await db.selectFrom('generationProviderOutputs')
    .select(['outputIndex', 'status'])
    .where('organizationId', '=', input.organizationId)
    .where('jobId', '=', input.jobId)
    .execute()
  const readyIndexes = new Set(
    existing.filter(row => row.status === 'ready').map(row => row.outputIndex),
  )

  for (const output of outputs) {
    if (output.payload.delivery === 'text' || readyIndexes.has(output.outputIndex))
      continue
    const storage = getGeneratedOutputStorageLocation({
      generationJobId: input.jobId,
      organizationId: input.organizationId,
      outputIndex: output.outputIndex,
    })
    if (output.payload.delivery === 'bytes') {
      await putObject({
        body: output.payload.bytes,
        bucket: storage.bucket,
        contentType: output.payload.mimeType,
        key: storage.key,
      })
    }
    else if (output.payload.delivery === 'stream') {
      await putObjectStream({
        body: output.payload.chunks,
        bucket: storage.bucket,
        contentType: output.payload.mimeType,
        key: storage.key,
      })
    }
    else if (output.payload.delivery === 'storage') {
      if (
        output.payload.bucket !== storage.bucket
        || output.payload.key !== storage.key
      ) {
        await copyObject({
          bucket: output.payload.bucket,
          destinationBucket: storage.bucket,
          destinationKey: storage.key,
          sourceBucket: output.payload.bucket,
          sourceKey: output.payload.key,
        })
      }
    }
    else {
      throw new Error('generation_provider_output_not_checkpointable')
    }
    const markedReady = await db.updateTable('generationProviderOutputs')
      .set({ status: 'ready', updatedAt: new Date() })
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .where('outputIndex', '=', output.outputIndex)
      .where('status', '=', 'staging')
      .returning('outputIndex')
      .executeTakeFirst()
    if (!markedReady)
      throw new Error('generation_provider_checkpoint_transition_conflict')
  }

  return {
    facts: input.facts,
    outputs: descriptors.map(descriptor => ({
      mediaType: descriptor.mediaType,
      metadata: descriptor.metadata,
      outputIndex: descriptor.outputIndex,
      payload: descriptor.delivery === 'text'
        ? {
            delivery: 'text' as const,
            mimeType: 'text/plain' as const,
            text: descriptor.text,
          }
        : {
            bucket: descriptor.storageBucket,
            delivery: 'storage' as const,
            key: descriptor.storageKey,
            mimeType: descriptor.mimeType,
          },
    })),
  }
}
