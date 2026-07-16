import { createOpenRouterHttpClient } from '@talelabs/openrouter'

export function fakeProvider() {
  const bodies: Array<Record<string, unknown>> = []
  let submissions = 0
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const parsedUrl = new URL(String(url))
    if (init?.body)
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
    if (parsedUrl.pathname === '/api/v1/images') {
      return new Response(JSON.stringify({
        data: [{ b64_json: 'iVBORw0KGgo=', media_type: 'image/png' }],
        usage: { cost: 0.01 },
      }), { headers: { 'content-type': 'application/json' } })
    }
    if (parsedUrl.pathname === '/api/v1/chat/completions') {
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
      apiKey: 'verification-key',
      fetch,
    }),
  }
}
