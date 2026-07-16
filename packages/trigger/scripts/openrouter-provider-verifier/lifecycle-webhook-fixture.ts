import type { ResolvedGenerationProviderAdapter } from '../../src/generation/adapters/contracts.js'

import { Readable } from 'node:stream'

let polls = 0

async function normalizeWebhookFixture() {
  return {
    externalJobId: 'video-job-0',
    status: 'completed' as const,
  }
}

async function pollWebhookFixture() {
  polls += 1
  if (polls === 1)
    return { pollAfterMs: 5_000, status: 'pending' as const }
  return {
    outputs: [{
      mediaType: 'video' as const,
      outputIndex: 0,
      payload: {
        chunks: Readable.from([
          new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]),
        ]),
        delivery: 'stream' as const,
        mimeType: 'video/mp4' as const,
      },
    }],
    status: 'completed' as const,
  }
}

async function submitWebhookFixture() {
  return {
    externalJobId: 'video-job-0',
    pollAfterMs: 5_000,
    status: 'submitted' as const,
  }
}

export const webhookRecoveryAdapter
  = {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['webhook', 'poll'],
      deliveries: ['stream'],
      submission: 'asynchronous',
    },
    normalizeWebhook: normalizeWebhookFixture,
    poll: pollWebhookFixture,
    submit: submitWebhookFixture,
  } satisfies ResolvedGenerationProviderAdapter['adapter']
