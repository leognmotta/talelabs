/** fal queue response schemas and provider-neutral output extraction. */

import { z } from 'zod'

/** One fal-hosted output file descriptor returned in a result payload. */
const falFileSchema = z.object({
  content_type: z.string().optional(),
  height: z.number().optional(),
  url: z.string(),
  width: z.number().optional(),
})

/** Submission response returned by a fal queue POST. */
export const falSubmitSchema = z.object({
  cancel_url: z.url().optional(),
  request_id: z.string().min(1),
  response_url: z.url(),
  status_url: z.url().optional(),
})

/** Accepted non-terminal best-effort cancellation response returned by fal. */
export const falCancellationRequestedSchema = z.object({
  status: z.literal('CANCELLATION_REQUESTED'),
})

/** Terminal cancellation response for work that completed before cancellation. */
export const falAlreadyCompletedSchema = z.object({
  status: z.literal('ALREADY_COMPLETED'),
})

/** Terminal cancellation response for an unknown fal request identity. */
export const falCancellationNotFoundSchema = z.object({
  status: z.literal('NOT_FOUND'),
})

/** Status response returned by a fal queue status GET. */
export const falStatusSchema = z.object({
  error: z.string().max(4_096).optional(),
  error_type: z.string().max(128).optional(),
  status: z.string(),
})

/**
 * Result response returned by a fal queue result GET. Unknown model-specific
 * fields are stripped; the known media containers cover image, video, and audio
 * outputs across fal models.
 */
export const falResultSchema = z.object({
  audio: falFileSchema.optional(),
  audios: z.array(falFileSchema).optional(),
  image: falFileSchema.optional(),
  images: z.array(falFileSchema).optional(),
  url: z.string().optional(),
  video: falFileSchema.optional(),
  videos: z.array(falFileSchema).optional(),
})

/** One extracted fal output URL and its declared content type. */
export interface FalMediaOutput {
  mimeType: null | string
  url: string
}

function collect(files: z.infer<typeof falFileSchema>[]): FalMediaOutput[] {
  return files.map(file => ({ mimeType: file.content_type ?? null, url: file.url }))
}

/** Extracts ordered output media from one fal result by expected media type. */
export function extractFalMediaOutputs(
  result: z.infer<typeof falResultSchema>,
  mediaType: 'audio' | 'image' | 'video',
): FalMediaOutput[] {
  if (mediaType === 'image') {
    if (result.images?.length)
      return collect(result.images)
    if (result.image)
      return collect([result.image])
  }
  if (mediaType === 'video') {
    if (result.video)
      return collect([result.video])
    if (result.videos?.length)
      return collect(result.videos)
  }
  if (mediaType === 'audio') {
    if (result.audio)
      return collect([result.audio])
    if (result.audios?.length)
      return collect(result.audios)
  }
  if (result.url)
    return [{ mimeType: null, url: result.url }]
  return []
}

/** Adapts a bounded media stream into the normalized async chunk iterable. */
export async function* falMediaChunks(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  try {
    while (true) {
      const next = await reader.read()
      if (next.done)
        break
      if (next.value)
        yield next.value
    }
  }
  finally {
    reader.releaseLock()
  }
}
