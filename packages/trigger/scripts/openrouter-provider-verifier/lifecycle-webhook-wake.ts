import assert from 'node:assert/strict'

import { runGenerationProviderLifecycle } from '../../src/generation/adapters/lifecycle/runner.js'
import { webhookRecoveryAdapter } from './lifecycle-webhook-fixture.js'
import { providerRequest } from './requests.js'
import { currentRoute, pinnedRoute } from './routes.js'

const persistedWakeAllowances: boolean[] = []

async function waitForWebhookPoll(
  _delayMs: number,
  allowPersistedCompletion: boolean,
) {
  persistedWakeAllowances.push(allowPersistedCompletion)
  return persistedWakeAllowances.length === 1
}

/** Proves a terminal callback wake is consumed before pending recovery polls. */
export async function verifyWebhookWakeBackoff() {
  persistedWakeAllowances.length = 0
  const route = currentRoute('talelabs/seedance-2.0', 'textToVideo')
  const result = await runGenerationProviderLifecycle({
    request: providerRequest({ route }),
    resolvedAdapter: {
      adapter: webhookRecoveryAdapter,
      requiresDurableSubmissionBoundary: false,
      route: pinnedRoute(route),
    },
    waitForPoll: waitForWebhookPoll,
  })
  assert.deepEqual(persistedWakeAllowances, [true, false])
  assert.equal(result.outputs[0]?.payload.delivery, 'stream')
}
