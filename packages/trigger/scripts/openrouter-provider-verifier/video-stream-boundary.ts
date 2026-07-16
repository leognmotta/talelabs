/** Hard output-size boundary scenario for streamed OpenRouter video responses. */

import assert from 'node:assert/strict'

import { validatedOpenRouterVideoStream } from '@talelabs/openrouter'

/** Proves streamed video bytes are rejected at the configured hard ceiling. */
export async function verifyVideoStreamBoundary() {
  const prefix = new Uint8Array([
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
  ])
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(prefix)
      controller.enqueue(new Uint8Array([1]))
      controller.close()
    },
  })
  await assert.rejects(async () => {
    for await (const _chunk of validatedOpenRouterVideoStream(stream, 12)) {
      // Consume the stream so validation runs at the storage boundary.
    }
  }, /provider_response_invalid/)
}
