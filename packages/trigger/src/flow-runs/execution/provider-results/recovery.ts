import type {
  NormalizedGenerationOutput,
  NormalizedGenerationProviderFacts,
} from '@talelabs/flows'

import type { GenerationProviderLifecycleResult } from '../../../generation/adapters/lifecycle/runner.js'
import { db } from '@talelabs/db'

import { getAssetBucket } from '@talelabs/storage'
import { promoteStagingProviderOutputs } from './storage-recovery.js'

type OutputMetadata = Readonly<Record<string, boolean | number | string>>

/** Recovers a complete staged result, preferring already-canonical outputs. */
export async function recoverGenerationProviderResult(input: {
  expectedOutputCount: number
  jobId: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  organizationId: string
}): Promise<GenerationProviderLifecycleResult | null> {
  if (!await promoteStagingProviderOutputs(input))
    return null
  const [checkpoint, staged, job] = await Promise.all([
    db.selectFrom('generationProviderResults')
      .select([
        'expectedOutputCount',
        'providerCostUsd',
        'providerGenerationId',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .executeTakeFirst(),
    db.selectFrom('generationProviderOutputs')
      .select([
        'delivery',
        'mediaType',
        'metadata',
        'mimeType',
        'outputIndex',
        'status',
        'storageBucket',
        'storageKey',
        'text',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .execute(),
    db.selectFrom('generationJobs')
      .select(['providerCostUsd', 'providerGenerationId'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.jobId)
      .executeTakeFirst(),
  ])
  const canonical = input.mediaType === 'text'
    ? await db.selectFrom('generationJobTextOutputs')
        .select(['outputIndex', 'text'])
        .where('organizationId', '=', input.organizationId)
        .where('jobId', '=', input.jobId)
        .execute()
    : await db.selectFrom('assets')
        .select(['metadata', 'mimeType', 'outputIndex', 'storageKey', 'visibility'])
        .where('organizationId', '=', input.organizationId)
        .where('generationJobId', '=', input.jobId)
        .where('deletedAt', 'is', null)
        .where('purgedAt', 'is', null)
        .execute()

  if (checkpoint && checkpoint.expectedOutputCount !== input.expectedOutputCount)
    throw new Error('generation_provider_checkpoint_output_count_mismatch')

  const outputs: NormalizedGenerationOutput[] = []
  for (let outputIndex = 0; outputIndex < input.expectedOutputCount; outputIndex += 1) {
    const canonicalOutput = canonical.find(row => row.outputIndex === outputIndex)
    if (canonicalOutput) {
      outputs.push(input.mediaType === 'text'
        ? {
            mediaType: 'text',
            outputIndex,
            payload: {
              delivery: 'text',
              mimeType: 'text/plain',
              text: 'text' in canonicalOutput ? canonicalOutput.text : '',
            },
          }
        : {
            mediaType: input.mediaType,
            metadata: 'metadata' in canonicalOutput
              ? canonicalOutput.metadata as OutputMetadata
              : undefined,
            outputIndex,
            payload: {
              bucket: 'visibility' in canonicalOutput
                ? getAssetBucket(canonicalOutput.visibility)
                : '',
              delivery: 'storage',
              key: 'storageKey' in canonicalOutput
                ? canonicalOutput.storageKey
                : '',
              mimeType: 'mimeType' in canonicalOutput
                ? canonicalOutput.mimeType
                : '',
            },
          })
      continue
    }

    const stagedOutput = staged.find(row => (
      row.outputIndex === outputIndex && row.status === 'ready'
    ))
    if (!stagedOutput || stagedOutput.mediaType !== input.mediaType)
      return null
    if (stagedOutput.delivery === 'text' && stagedOutput.text !== null) {
      outputs.push({
        mediaType: 'text',
        metadata: stagedOutput.metadata as OutputMetadata,
        outputIndex,
        payload: {
          delivery: 'text',
          mimeType: 'text/plain',
          text: stagedOutput.text,
        },
      })
      continue
    }
    if (
      stagedOutput.delivery !== 'storage'
      || stagedOutput.mimeType === null
      || stagedOutput.storageBucket === null
      || stagedOutput.storageKey === null
      || stagedOutput.mediaType === 'text'
    ) {
      return null
    }
    outputs.push({
      mediaType: stagedOutput.mediaType,
      metadata: stagedOutput.metadata as OutputMetadata,
      outputIndex,
      payload: {
        bucket: stagedOutput.storageBucket,
        delivery: 'storage',
        key: stagedOutput.storageKey,
        mimeType: stagedOutput.mimeType,
      },
    })
  }

  const cost = checkpoint?.providerCostUsd ?? job?.providerCostUsd
  const facts: NormalizedGenerationProviderFacts = {
    ...(cost === null || cost === undefined
      ? {}
      : { providerCostUsd: Number(cost) }),
    ...((checkpoint?.providerGenerationId ?? job?.providerGenerationId) === null
      || (checkpoint?.providerGenerationId ?? job?.providerGenerationId) === undefined
      ? {}
      : {
          providerGenerationId:
            checkpoint?.providerGenerationId ?? job?.providerGenerationId ?? undefined,
        }),
  }
  return { facts, outputs }
}
