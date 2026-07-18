/** Streams normalized browser provider outputs into canonical server finalization. */

import type { NormalizedGenerationOutput } from '@talelabs/flows'

import { BROWSER_RUN_MAX_OUTPUT_BYTES } from '@talelabs/flows'

import { writeBrowserRunJournal } from './browser-run-journal'
import {
  createBrowserOutputGrant,
  finalizeBrowserMediaOutput,
  finalizeBrowserTextOutput,
} from './browser-runtime-api'

interface OutputTransferScope {
  executorId: string
  fenceToken: number
  jobId: string
  organizationId: string
  providerJobId: null | string
  runId: string
  userId: string
}

function transferFailure(
  message: string,
  code: 'generation_failed' | 'provider_response_invalid',
) {
  return Object.assign(new Error(message), { code })
}

/** Collects chunks into a Blob, aborting once the hard byte limit is crossed. */
async function collectBoundedBlob(
  chunks: AsyncIterable<Uint8Array>,
  mimeType: string,
) {
  const parts: BlobPart[] = []
  let totalBytes = 0
  for await (const chunk of chunks) {
    totalBytes += chunk.byteLength
    if (totalBytes > BROWSER_RUN_MAX_OUTPUT_BYTES) {
      throw transferFailure(
        'browser_output_too_large',
        'provider_response_invalid',
      )
    }
    parts.push(new Uint8Array(chunk).buffer)
  }
  if (totalBytes <= 0) {
    throw transferFailure(
      'browser_output_invalid',
      'provider_response_invalid',
    )
  }
  const body = new Blob(parts, { type: mimeType })
  return { body, contentLength: body.size }
}

async function readBoundedStream(
  stream: ReadableStream<Uint8Array>,
  mimeType: string,
) {
  const reader = stream.getReader()
  try {
    return await collectBoundedBlob(
      (async function* read() {
        while (true) {
          const next = await reader.read()
          if (next.done)
            return
          yield next.value
        }
      })(),
      mimeType,
    )
  }
  catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }
  finally {
    reader.releaseLock()
  }
}

/**
 * Materializes one media output as an exactly sized Blob. Every delivery form
 * is counted while it is read: a missing or dishonest Content-Length can never
 * move more than the hard output limit into the upload.
 */
async function mediaBody(
  output: NormalizedGenerationOutput,
  signal: AbortSignal,
) {
  if (output.payload.delivery === 'bytes') {
    const bytes = output.payload.bytes
    if (
      bytes.byteLength <= 0
      || bytes.byteLength > BROWSER_RUN_MAX_OUTPUT_BYTES
    ) {
      throw transferFailure(
        'browser_output_too_large',
        'provider_response_invalid',
      )
    }
    const buffer = new Uint8Array(bytes).buffer
    return {
      body: new Blob([buffer], { type: output.payload.mimeType }),
      contentLength: bytes.byteLength,
    }
  }
  if (output.payload.delivery === 'url') {
    const response = await fetch(output.payload.url, { signal }).catch(() => {
      throw transferFailure(
        'provider_output_download_failed',
        'provider_response_invalid',
      )
    })
    if (!response.ok || !response.body) {
      throw transferFailure(
        'provider_output_download_failed',
        'provider_response_invalid',
      )
    }
    const length = Number(response.headers.get('Content-Length'))
    if (Number.isSafeInteger(length) && length > BROWSER_RUN_MAX_OUTPUT_BYTES) {
      throw transferFailure(
        'browser_output_too_large',
        'provider_response_invalid',
      )
    }
    return readBoundedStream(response.body, output.payload.mimeType)
  }
  if (output.payload.delivery === 'stream') {
    return collectBoundedBlob(output.payload.chunks, output.payload.mimeType)
  }
  throw transferFailure(
    'browser_media_delivery_invalid',
    'provider_response_invalid',
  )
}

/** Finalizes ordered text and media outputs without retaining signed URLs. */
export async function transferBrowserOutputs(
  input: OutputTransferScope & {
    outputs: readonly NormalizedGenerationOutput[]
    signal: AbortSignal
  },
) {
  for (const output of [...input.outputs].toSorted(
    (a, b) => a.outputIndex - b.outputIndex,
  )) {
    if (output.payload.delivery === 'url') {
      await writeBrowserRunJournal({
        executorId: input.executorId,
        jobId: input.jobId,
        nextEligibleAt: null,
        organizationId: input.organizationId,
        outputIndex: output.outputIndex,
        phase: 'downloading',
        providerJobId: input.providerJobId,
        runId: input.runId,
        updatedAt: new Date().toISOString(),
        userId: input.userId,
      })
    }
    if (output.payload.delivery === 'text') {
      await writeBrowserRunJournal({
        executorId: input.executorId,
        jobId: input.jobId,
        nextEligibleAt: null,
        organizationId: input.organizationId,
        outputIndex: output.outputIndex,
        phase: 'finalizing',
        providerJobId: input.providerJobId,
        runId: input.runId,
        updatedAt: new Date().toISOString(),
        userId: input.userId,
      })
      await finalizeBrowserTextOutput(input, input.jobId, {
        outputIndex: output.outputIndex,
        text: output.payload.text,
      })
      continue
    }
    const materialized = await mediaBody(output, input.signal)
    await writeBrowserRunJournal({
      executorId: input.executorId,
      jobId: input.jobId,
      nextEligibleAt: null,
      organizationId: input.organizationId,
      outputIndex: output.outputIndex,
      phase: 'uploading',
      providerJobId: input.providerJobId,
      runId: input.runId,
      updatedAt: new Date().toISOString(),
      userId: input.userId,
    })
    const grant = await createBrowserOutputGrant(input, input.jobId, {
      contentLength: materialized.contentLength,
      mimeType: output.payload.mimeType,
      outputIndex: output.outputIndex,
    })
    if (!grant.alreadyUploaded) {
      if (!grant.uploadUrl) {
        throw transferFailure(
          'browser_output_grant_invalid',
          'generation_failed',
        )
      }
      // The grant signs the exact Content-Length, which the browser derives
      // from the fixed-size Blob body; a mismatched upload is rejected by R2.
      const upload = await fetch(grant.uploadUrl, {
        body: materialized.body,
        headers: grant.headers,
        method: 'PUT',
        signal: input.signal,
      }).catch(() => {
        throw transferFailure(
          'browser_output_upload_failed',
          'generation_failed',
        )
      })
      if (!upload.ok) {
        throw transferFailure(
          'browser_output_upload_rejected',
          'provider_response_invalid',
        )
      }
    }
    await writeBrowserRunJournal({
      executorId: input.executorId,
      jobId: input.jobId,
      nextEligibleAt: null,
      organizationId: input.organizationId,
      outputIndex: output.outputIndex,
      phase: 'finalizing',
      providerJobId: input.providerJobId,
      runId: input.runId,
      updatedAt: new Date().toISOString(),
      userId: input.userId,
    })
    await finalizeBrowserMediaOutput(input, input.jobId, {
      metadata: output.metadata,
      mimeType: output.payload.mimeType,
      outputIndex: output.outputIndex,
    })
  }
}
