/**
 * Server-only resolution of explicit credentials and managed platform secrets.
 */

import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type { ProviderRuntimeCredential } from '../contracts.js'

import process from 'node:process'

/** Resolves a matching credential without serializing or logging its secret. */
export function resolveProviderRuntimeCredential(
  provider: CatalogProviderBinding['provider'],
  explicit?: ProviderRuntimeCredential,
): ProviderRuntimeCredential {
  if (explicit) {
    if (explicit.provider !== provider)
      throw new Error('provider_runtime_credential_mismatch')
    return explicit
  }
  switch (provider) {
    case 'openrouter':
      return {
        provider: 'openrouter',
        resolveApiKey: () => process.env.OPENROUTER_API_KEY,
      }
  }
}
