/** Browser checkpoints and canonical output finalization behind active leases. */

import type { BrowserJobActor } from './browser-job-context.js'

import {
  BROWSER_RUN_MAX_OUTPUT_BYTES,
  readFlowRunExecutionMode,
  readFlowRunJobRequestPayload,
} from '@talelabs/flows'
import {
  copyObject,
  createUploadUrl,
  deleteObject,
  headObjectIfExists,
} from '@talelabs/storage'
import {
  finalizeGenerationOutputs,
  getGeneratedOutputStorageLocation,
  selectMockGenerationFixture,
} from '@talelabs/trigger'

import { HttpError } from '../../../middleware/error.js'
import {
  finalizeCanceledBrowserJob,
  withBrowserJob,
} from './browser-job-context.js'
import { assertBrowserJobOutputCommit } from './browser-runtime-policy.js'

function getBrowserOutputLocations(input: {
  executorId: string
  fenceToken: number
  jobId: string
  organizationId: string
  outputIndex: number
}) {
  const canonical = getGeneratedOutputStorageLocation({
    generationJobId: input.jobId,
    organizationId: input.organizationId,
    outputIndex: input.outputIndex,
  })
  return {
    canonical,
    upload: {
      ...canonical,
      key: `${canonical.key}/browser-upload/${encodeURIComponent(input.executorId)}/${input.fenceToken}`,
    },
  }
}

function isValidBrowserOutputObject(
  object: Awaited<ReturnType<typeof headObjectIfExists>>,
  mimeType: string,
) {
  const size = object?.ContentLength ?? 0
  return Boolean(
    object
    && size > 0
    && size <= BROWSER_RUN_MAX_OUTPUT_BYTES
    && object.ContentType === mimeType,
  )
}

/** Reconciles one canceled job under the fence after unfenced output work. */
async function finalizeCanceledBrowserJobFenced(input: BrowserJobActor) {
  return withBrowserJob(input, async ({ job, trx }) =>
    finalizeCanceledBrowserJob({
      job,
      organizationId: input.organizationId,
      runId: input.runId,
      trx,
    }))
}

/**
 * Issues an exact, short-lived upload target or recognizes a recovered upload.
 * The lease fence only covers validation; object-storage traffic runs after
 * the fence transaction is released so it cannot starve the database pool.
 */
export async function createBrowserOutputGrant(input: {
  contentLength: number
  contentMd5?: string
  executorId: string
  fenceToken: number
  jobId: string
  mimeType: string
  organizationId: string
  outputIndex: number
  runId: string
  userId: string
}) {
  const context = await withBrowserJob(
    input,
    async ({ artifact, job, run }) => {
      const request = readFlowRunJobRequestPayload({
        requestHash: job.requestHash,
        requestPayload: job.requestPayload,
      })
      if (
        job.mediaType === 'text'
        || input.outputIndex >= request.outputCount
        || !Number.isSafeInteger(input.contentLength)
        || input.contentLength <= 0
        || input.contentLength > BROWSER_RUN_MAX_OUTPUT_BYTES
        || !input.mimeType.toLowerCase().startsWith(`${job.mediaType}/`)
      ) {
        throw new HttpError(
          422,
          'browser_output_invalid',
          'The browser output is invalid.',
        )
      }
      return {
        canceled: run.status === 'canceled',
        executionMode: readFlowRunExecutionMode(
          artifact.snapshot.executionMode,
        ),
        mediaType: job.mediaType as 'audio' | 'image' | 'video',
      }
    },
  )
  if (context.canceled) {
    await finalizeCanceledBrowserJobFenced(input)
    throw new HttpError(409, 'run_canceled', 'The run was canceled.')
  }
  const locations = getBrowserOutputLocations({
    executorId: input.executorId,
    fenceToken: input.fenceToken,
    jobId: input.jobId,
    organizationId: input.organizationId,
    outputIndex: input.outputIndex,
  })
  const [canonicalObject, uploadObject] = await Promise.all([
    headObjectIfExists(locations.canonical),
    headObjectIfExists(locations.upload),
  ])
  const canonicalReady = isValidBrowserOutputObject(
    canonicalObject,
    input.mimeType,
  )
  const uploadReady = isValidBrowserOutputObject(uploadObject, input.mimeType)
  await Promise.all([
    canonicalObject && !canonicalReady
      ? deleteObject(locations.canonical)
      : Promise.resolve(),
    uploadObject && !uploadReady
      ? deleteObject(locations.upload)
      : Promise.resolve(),
  ])
  if (canonicalReady || uploadReady) {
    return {
      alreadyUploaded: true as const,
      expiresAt: null,
      headers: {},
      uploadUrl: null,
    }
  }
  if (context.executionMode === 'debug') {
    const fixture = selectMockGenerationFixture({
      mediaType: context.mediaType,
      outputIndex: input.outputIndex,
    })
    if (fixture.mimeType !== input.mimeType) {
      throw new HttpError(
        422,
        'browser_output_invalid',
        'The browser output is invalid.',
      )
    }
    await copyObject({
      bucket: fixture.storage.bucket,
      destinationBucket: locations.upload.bucket,
      destinationKey: locations.upload.key,
      sourceBucket: fixture.storage.bucket,
      sourceKey: fixture.storage.key,
    })
    return {
      alreadyUploaded: true as const,
      expiresAt: null,
      headers: {},
      uploadUrl: null,
    }
  }
  const expiresIn = 300
  return {
    alreadyUploaded: false as const,
    expiresAt: new Date(Date.now() + expiresIn * 1_000).toISOString(),
    headers: {
      'Content-Type': input.mimeType,
      ...(input.contentMd5 ? { 'Content-MD5': input.contentMd5 } : {}),
    },
    uploadUrl: await createUploadUrl({
      bucket: locations.upload.bucket,
      contentLength: input.contentLength,
      contentMd5: input.contentMd5,
      contentType: input.mimeType,
      expiresIn,
      ifNoneMatch: null,
      key: locations.upload.key,
    }),
  }
}

/** Verifies one direct upload before reusing the canonical Asset finalizer. */
export async function finalizeBrowserMediaOutput(input: {
  executorId: string
  fenceToken: number
  jobId: string
  metadata?: Record<string, boolean | number | string>
  mimeType: string
  organizationId: string
  outputIndex: number
  runId: string
  userId: string
}) {
  const context = await withBrowserJob(input, async ({ job, run }) => {
    const request = readFlowRunJobRequestPayload({
      requestHash: job.requestHash,
      requestPayload: job.requestPayload,
    })
    if (job.mediaType === 'text' || input.outputIndex >= request.outputCount) {
      throw new HttpError(
        422,
        'browser_output_invalid',
        'The browser output is invalid.',
      )
    }
    return { canceled: run.status === 'canceled', job }
  })
  if (context.canceled)
    return finalizeCanceledBrowserJobFenced(input)
  const { job } = context
  const locations = getBrowserOutputLocations({
    executorId: input.executorId,
    fenceToken: input.fenceToken,
    jobId: job.id,
    organizationId: input.organizationId,
    outputIndex: input.outputIndex,
  })
  const [canonicalObject, uploadObject] = await Promise.all([
    headObjectIfExists(locations.canonical),
    headObjectIfExists(locations.upload),
  ])
  const source = canonicalObject ? locations.canonical : locations.upload
  const object = canonicalObject ?? uploadObject
  if (!isValidBrowserOutputObject(object, input.mimeType)) {
    if (object)
      await deleteObject(source)
    throw new HttpError(
      422,
      'browser_output_invalid',
      'The uploaded browser output is invalid.',
    )
  }
  const finalized = await finalizeGenerationOutputs({
    assetIngestion: 'api',
    commitGuard: ({ trx }) => assertBrowserJobOutputCommit(input, trx),
    job: {
      ...job,
      mediaType: job.mediaType as 'audio' | 'image' | 'video',
    },
    outputs: [
      {
        mediaType: job.mediaType,
        metadata: input.metadata,
        outputIndex: input.outputIndex,
        payload: {
          bucket: source.bucket,
          delivery: 'storage',
          key: source.key,
          mimeType: input.mimeType,
        },
      },
    ],
  })
  if (uploadObject)
    await deleteObject(locations.upload).catch(() => undefined)
  if (finalized.state === 'canceled')
    return finalizeCanceledBrowserJobFenced(input)
  return { state: 'processing' as const }
}

/** Persists one text output through the same idempotent durable finalizer. */
export async function finalizeBrowserTextOutput(input: {
  executorId: string
  fenceToken: number
  jobId: string
  organizationId: string
  outputIndex: number
  runId: string
  text: string
  userId: string
}) {
  const context = await withBrowserJob(input, async ({ job, run }) => {
    const request = readFlowRunJobRequestPayload({
      requestHash: job.requestHash,
      requestPayload: job.requestPayload,
    })
    if (job.mediaType !== 'text' || input.outputIndex >= request.outputCount) {
      throw new HttpError(
        422,
        'browser_output_invalid',
        'The browser output is invalid.',
      )
    }
    return { canceled: run.status === 'canceled', job }
  })
  if (context.canceled)
    return finalizeCanceledBrowserJobFenced(input)
  const finalized = await finalizeGenerationOutputs({
    commitGuard: ({ trx }) => assertBrowserJobOutputCommit(input, trx),
    job: { ...context.job, mediaType: 'text' },
    outputs: [
      {
        mediaType: 'text',
        outputIndex: input.outputIndex,
        payload: {
          delivery: 'text',
          mimeType: 'text/plain',
          text: input.text,
        },
      },
    ],
  })
  if (finalized.state === 'canceled')
    return finalizeCanceledBrowserJobFenced(input)
  return finalized
}
