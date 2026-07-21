/**
 * Server-only resolution of explicit credentials and managed platform secrets.
 */

import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type {
  FalRuntimeCredential,
  OpenRouterRuntimeCredential,
  ProviderRuntimeCredential,
} from '../contracts.js'

import process from 'node:process'

/** Resolves the fal platform or explicit BYOK credential. */
export function resolveProviderRuntimeCredential(
  provider: 'fal',
  explicit?: ProviderRuntimeCredential,
): FalRuntimeCredential
/** Resolves the OpenRouter platform or explicit BYOK credential. */
export function resolveProviderRuntimeCredential(
  provider: 'openrouter',
  explicit?: ProviderRuntimeCredential,
): OpenRouterRuntimeCredential
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
    case 'fal':
      return {
        provider: 'fal',
        resolveApiKey: () => process.env.FAL_API_KEY,
      }
    case 'openrouter':
      return {
        provider: 'openrouter',
        resolveApiKey: () => process.env.OPENROUTER_API_KEY,
      }
  }
}

/**
 * Reports whether managed composition can resolve a non-empty platform secret
 * for one provider without returning, persisting, serializing, or logging it.
 */
export function hasManagedProviderCredential(
  provider: CatalogProviderBinding['provider'],
): boolean {
  try {
    const credential = provider === 'fal'
      ? resolveProviderRuntimeCredential('fal')
      : resolveProviderRuntimeCredential('openrouter')
    return Boolean(credential.resolveApiKey()?.trim())
  }
  catch {
    return false
  }
}
