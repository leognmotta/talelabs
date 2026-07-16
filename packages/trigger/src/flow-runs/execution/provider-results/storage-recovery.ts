import { db } from '@talelabs/db'
import { headObject } from '@talelabs/storage'

function isMissingStorageObject(error: unknown) {
  if (!error || typeof error !== 'object')
    return false
  const record = error as Record<string, unknown>
  const metadata = record.$metadata
  return record.name === 'NotFound'
    || record.name === 'NoSuchKey'
    || (metadata !== null
      && typeof metadata === 'object'
      && (metadata as Record<string, unknown>).httpStatusCode === 404)
}

export async function inspectStagedProviderObject(
  input: {
    mimeType: string
    storageBucket: string
    storageKey: string
  },
  inspectObject: typeof headObject = headObject,
) {
  try {
    const object = await inspectObject({
      bucket: input.storageBucket,
      key: input.storageKey,
    })
    if (
      !object.ContentLength
      || object.ContentLength <= 0
      || object.ContentType !== input.mimeType
    ) {
      throw new Error('generation_provider_checkpoint_object_invalid')
    }
    return true
  }
  catch (error) {
    if (isMissingStorageObject(error))
      return false
    throw error
  }
}

/** Promotes atomically stored deterministic objects left behind as staging. */
export async function promoteStagingProviderOutputs(input: {
  jobId: string
  organizationId: string
}) {
  const staging = await db.selectFrom('generationProviderOutputs')
    .select([
      'delivery',
      'mimeType',
      'outputIndex',
      'storageBucket',
      'storageKey',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('jobId', '=', input.jobId)
    .where('status', '=', 'staging')
    .orderBy('outputIndex')
    .execute()
  for (const output of staging) {
    if (
      output.delivery !== 'storage'
      || !output.mimeType
      || !output.storageBucket
      || !output.storageKey
    ) {
      throw new Error('generation_provider_checkpoint_descriptor_invalid')
    }
    if (!await inspectStagedProviderObject({
      mimeType: output.mimeType,
      storageBucket: output.storageBucket,
      storageKey: output.storageKey,
    })) {
      return false
    }
    await db.updateTable('generationProviderOutputs')
      .set({ status: 'ready', updatedAt: new Date() })
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .where('outputIndex', '=', output.outputIndex)
      .where('status', '=', 'staging')
      .execute()
  }
  return true
}
