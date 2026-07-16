import type { GenerationProviderLifecycleResult } from '../../src/generation/adapters/lifecycle/runner.js'

import assert from 'node:assert/strict'

import { runGenerationProviderLifecycle } from '../../src/generation/adapters/lifecycle/runner.js'
import { immediateRecoveryAdapter } from './lifecycle-immediate-fixture.js'
import { providerRequest } from './requests.js'
import { currentRoute, pinnedRoute } from './routes.js'

async function resumeImmediateCompleted(): Promise<GenerationProviderLifecycleResult> {
  return {
    facts: { providerCostUsd: 0.01 },
    outputs: [{
      mediaType: 'image',
      outputIndex: 0,
      payload: {
        bucket: 'staged',
        delivery: 'storage',
        key: 'job/output-0',
        mimeType: 'image/png',
      },
    }],
  }
}

/** Proves a durable completed result wins over the uncertain-submit guard. */
export async function verifyLifecycleRecovery() {
  const route = currentRoute('talelabs/gpt-image-2', 'textToImage')
  const recovered = await runGenerationProviderLifecycle({
    providerSubmittedAt: new Date(),
    request: providerRequest({ route }),
    resolvedAdapter: {
      adapter: immediateRecoveryAdapter,
      requiresDurableSubmissionBoundary: true,
      route: pinnedRoute(route),
    },
    resumeCompleted: resumeImmediateCompleted,
  })
  assert.equal(recovered.facts.providerCostUsd, 0.02)
  assert.equal(recovered.outputs[0]?.payload.delivery, 'storage')
}
