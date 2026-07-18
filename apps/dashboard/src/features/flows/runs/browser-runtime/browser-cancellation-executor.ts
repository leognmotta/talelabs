/** Provider cancellation reconciliation for authoritative browser manifests. */

import type { BrowserRunManifest } from '@talelabs/flows'

import type { BrowserLeasedRunScope } from './browser-runtime-api'

import {
  createOpenRouterBrowserProviderAdapter,
  resolveCredential,
} from '@talelabs/providers/browser'
import {
  acknowledgeBrowserCancellation,
} from './browser-runtime-api'

type BrowserCancellation = BrowserRunManifest['cancellations'][number]

function credentialError(
  code: 'credential_required' | 'credential_store_unavailable',
) {
  return Object.assign(new Error(code), { browserExecutorCode: code })
}

/** Attempts or safely resolves one provider cancellation without exposing its key. */
export async function executeBrowserCancellation(input: {
  cancellation: BrowserCancellation
  scope: BrowserLeasedRunScope
  signal: AbortSignal
  userId: string
}) {
  const { cancellation, scope } = input
  if (cancellation.cancellation === 'unsupported') {
    return acknowledgeBrowserCancellation(scope, cancellation.jobId, {
      final: true,
      result: 'unsupported',
    })
  }
  if (!cancellation.providerJobId) {
    return acknowledgeBrowserCancellation(scope, cancellation.jobId, {
      final: true,
      result: 'unavailable',
    })
  }
  let credential: string | null
  try {
    credential = await resolveCredential({
      providerId: 'openrouter',
      userId: input.userId,
    })
  }
  catch {
    throw credentialError('credential_store_unavailable')
  }
  if (!credential)
    throw credentialError('credential_required')
  const apiKey = credential
  const adapter = createOpenRouterBrowserProviderAdapter({
    binding: cancellation.executionContract.providerBinding,
    credential: { provider: 'openrouter', resolveApiKey: () => apiKey },
    resolveAsset: async () => {
      throw new Error('browser_cancellation_does_not_resolve_assets')
    },
    signal: input.signal,
  })
  if (!adapter.cancel) {
    return acknowledgeBrowserCancellation(scope, cancellation.jobId, {
      final: true,
      result: 'unsupported',
    })
  }
  const cancel = adapter.cancel
  const outcome = await cancel(cancellation.providerJobId)
  return acknowledgeBrowserCancellation(scope, cancellation.jobId, {
    final: outcome.final,
    result: outcome.accepted ? 'accepted' : 'rejected',
  })
}
