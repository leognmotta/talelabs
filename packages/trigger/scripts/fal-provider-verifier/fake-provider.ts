/** Deterministic fake fal queue service for worker and browser verification. */

import { FAL_QUEUE_BASE } from '@talelabs/models-catalog'
import { createFalHttpClient } from '@talelabs/providers/server'

/** One captured fake fal HTTP call. */
export interface CapturedFalCall {
  /** Parsed JSON request body when present. */
  body: Record<string, unknown> | null
  /** Lower-cased request headers observed by the fake transport. */
  headers: Record<string, string>
  /** HTTP method used by the adapter. */
  method: string
  /** Absolute URL requested by the adapter. */
  url: string
}

/** Creates a deterministic fake queue fetch, client, and captured call list. */
export function fakeFalProvider(input?: {
  cancelResponse?: 'already_completed' | 'invalid' | 'not_found' | 'requested'
  mediaType?: 'audio' | 'image' | 'video'
  outputCount?: number
  queueStatuses?: readonly {
    error?: string
    error_type?: string
    status: string
  }[]
  submissionStatus?: number
}) {
  const calls: CapturedFalCall[] = []
  let statusReads = 0
  let submissions = 0
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const absoluteUrl = String(url)
    const parsedUrl = new URL(absoluteUrl)
    const method = init?.method ?? 'GET'
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : null
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((value, name) => {
      headers[name] = value
    })
    calls.push({ body, headers, method, url: absoluteUrl })

    if (method === 'POST') {
      const status = input?.submissionStatus ?? 200
      if (status !== 200) {
        const message
          = status === 401
            ? 'Authorization token=verification-secret is invalid.'
            : status === 403
              ? 'User is locked. Reason: Exhausted balance. Top up your balance.'
              : 'The prompt is invalid.'
        const payload
          = status === 403 ? { detail: message } : { error: { message } }
        return new Response(JSON.stringify(payload), {
          headers: { 'content-type': 'application/json' },
          status,
        })
      }
      submissions += 1
      const requestId = `fal-request-${submissions}`
      const requestBase = `${parsedUrl.origin}${parsedUrl.pathname}/requests/${requestId}`
      return new Response(
        JSON.stringify({
          cancel_url: `${requestBase}/cancel`,
          request_id: requestId,
          response_url: `${requestBase}/response`,
          status_url: `${requestBase}/status`,
        }),
        { headers: { 'content-type': 'application/json' } },
      )
    }
    if (method === 'PUT' && parsedUrl.pathname.endsWith('/cancel')) {
      const cancellation = input?.cancelResponse ?? 'requested'
      if (cancellation === 'already_completed') {
        return new Response(JSON.stringify({ status: 'ALREADY_COMPLETED' }), {
          headers: { 'content-type': 'application/json' },
          status: 400,
        })
      }
      if (cancellation === 'not_found') {
        return new Response(JSON.stringify({ status: 'NOT_FOUND' }), {
          headers: { 'content-type': 'application/json' },
          status: 404,
        })
      }
      if (cancellation === 'invalid') {
        return new Response(JSON.stringify({ status: 'INVALID_REQUEST' }), {
          headers: { 'content-type': 'application/json' },
          status: 400,
        })
      }
      return new Response(
        JSON.stringify({ status: 'CANCELLATION_REQUESTED' }),
        {
          headers: { 'content-type': 'application/json' },
          status: 202,
        },
      )
    }
    if (method === 'GET' && parsedUrl.pathname.endsWith('/status')) {
      const queueStatuses = input?.queueStatuses ?? [{ status: 'COMPLETED' }]
      const status = queueStatuses[
        Math.min(statusReads, queueStatuses.length - 1)
      ] ?? { status: 'COMPLETED' }
      statusReads += 1
      return new Response(JSON.stringify(status), {
        headers: { 'content-type': 'application/json' },
      })
    }
    if (method === 'GET' && parsedUrl.hostname === 'v3.fal.media') {
      const mediaType = input?.mediaType ?? 'image'
      const contentType
        = mediaType === 'video'
          ? 'video/mp4'
          : mediaType === 'audio'
            ? 'audio/mpeg'
            : 'image/png'
      return new Response(new Uint8Array([0x89, 0x50, 0x4E, 0x47]), {
        headers: { 'content-type': contentType },
      })
    }
    if (
      method === 'GET'
      && parsedUrl.hostname === 'storage.googleapis.com'
      && parsedUrl.pathname.startsWith('/download/storage/v1/b/falserverless/o/')
    ) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4E, 0x47]), {
        headers: { 'content-type': 'image/png' },
      })
    }
    if (method === 'GET' && /\/requests\/[^/]+$/.test(parsedUrl.pathname)) {
      const mediaType = input?.mediaType ?? 'image'
      const outputCount = input?.outputCount ?? 1
      const contentType
        = mediaType === 'video'
          ? 'video/mp4'
          : mediaType === 'audio'
            ? 'audio/mpeg'
            : 'image/png'
      const extension
        = mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'mp3' : 'png'
      const outputs = Array.from({ length: outputCount }, (_, index) => ({
        content_type: contentType,
        url: `https://v3.fal.media/files/verification/output-${index}.${extension}`,
      }))
      const field
        = mediaType === 'video'
          ? 'videos'
          : mediaType === 'audio'
            ? 'audios'
            : 'images'
      const payload = mediaType === 'audio' && outputCount === 1
        ? { audio: outputs[0] }
        : { [field]: outputs }
      return new Response(JSON.stringify(payload), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(
      JSON.stringify({ error: { message: 'unexpected path' } }),
      {
        headers: { 'content-type': 'application/json' },
        status: 404,
      },
    )
  }
  return {
    calls,
    client: createFalHttpClient({
      baseUrl: FAL_QUEUE_BASE,
      credential: {
        provider: 'fal',
        resolveApiKey: () => 'verification-key',
      },
      fetch,
    }),
    fetch,
  }
}
