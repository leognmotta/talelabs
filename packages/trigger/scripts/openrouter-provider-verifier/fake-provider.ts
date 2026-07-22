/** Deterministic fake OpenRouter HTTP service used by provider verification. */

import { createOpenRouterHttpClient } from '@talelabs/providers/server'

function musicSseResponse() {
  const encoded = [
    btoa(String.fromCharCode(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0)),
    btoa(String.fromCharCode(0x57, 0x41, 0x56, 0x45)),
  ]
  const payload = [
    ': keepalive\r\n\r\n',
    `data: ${JSON.stringify({
      choices: [{ delta: { audio: { data: encoded[0] } } }],
      id: 'music-generation-0',
    })}\r\n\r\n`,
    `data: ${JSON.stringify({
      choices: [{ delta: { audio: { data: encoded[1] } } }],
    })}\r\n\r\n`,
    `data: ${JSON.stringify({ choices: [], usage: { cost: 0.04 } })}\r\n\r\n`,
    'data: [DONE]\r\n\r\n',
  ].join('')
  const bytes = new TextEncoder().encode(payload)
  const offsets = [0, 13, 41, 97, 151, bytes.byteLength]
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 1; index < offsets.length; index += 1) {
        controller.enqueue(bytes.subarray(offsets[index - 1], offsets[index]))
      }
      controller.close()
    },
  }), {
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  })
}

/** Creates a deterministic fake HTTP client and captured request-body list. */
export function fakeProvider() {
  const bodies: Array<Record<string, unknown>> = []
  let submissions = 0
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const parsedUrl = new URL(String(url))
    const body = init?.body
      ? JSON.parse(String(init.body)) as Record<string, unknown>
      : undefined
    if (body)
      bodies.push(body)
    if (parsedUrl.pathname === '/api/v1/images') {
      return new Response(JSON.stringify({
        data: [{ b64_json: 'iVBORw0KGgo=', media_type: 'image/png' }],
        usage: { cost: 0.01 },
      }), { headers: { 'content-type': 'application/json' } })
    }
    if (parsedUrl.pathname === '/api/v1/chat/completions') {
      if (Array.isArray(body?.modalities) && body.modalities.includes('audio'))
        return musicSseResponse()
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Verified text output.' } }],
        id: 'chat-generation-0',
        usage: { cost: 0.02 },
      }), { headers: { 'content-type': 'application/json' } })
    }
    if (parsedUrl.pathname === '/api/v1/audio/speech') {
      return new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04]), {
        headers: {
          'content-type': 'audio/mpeg',
          'x-generation-id': 'speech-generation-0',
        },
      })
    }
    if (parsedUrl.pathname === '/api/v1/generation') {
      return new Response(JSON.stringify({
        data: { total_cost: 0.03 },
      }), { headers: { 'content-type': 'application/json' } })
    }
    if (parsedUrl.pathname === '/api/v1/videos' && init?.method === 'POST') {
      submissions += 1
      return new Response(JSON.stringify({ id: `video-job-${submissions}` }), {
        headers: { 'content-type': 'application/json' },
        status: 202,
      })
    }
    if (parsedUrl.pathname.endsWith('/content')) {
      return new Response(
        new Uint8Array([
          0,
          0,
          0,
          24,
          0x66,
          0x74,
          0x79,
          0x70,
          0x69,
          0x73,
          0x6F,
          0x6D,
        ]),
        { headers: { 'content-type': 'video/mp4' } },
      )
    }
    if (parsedUrl.pathname.startsWith('/api/v1/videos/')) {
      return new Response(JSON.stringify({
        generation_id: 'video-generation-0',
        status: 'completed',
        usage: { cost: 0.08 },
      }), { headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: { message: 'unexpected path' } }), {
      headers: { 'content-type': 'application/json' },
      status: 404,
    })
  }
  return {
    bodies,
    client: createOpenRouterHttpClient({
      credential: {
        provider: 'openrouter',
        resolveApiKey: () => 'verification-key',
      },
      fetch,
    }),
    fetch,
  }
}
