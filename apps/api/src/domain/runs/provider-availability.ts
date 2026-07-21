/**
 * Server policy for which providers TaleLabs may execute in each run mode.
 *
 * Provider routing is decided by catalog binding priority; these sets decide
 * which providers are eligible to be routed to in a given run mode. Keeping the
 * policy in typed code (never an environment variable) makes credit-provider
 * enablement reviewable and deployed with the code that consumes it.
 */

import type { CatalogProviderId } from '@talelabs/models-catalog'

import { hasManagedProviderCredential } from '@talelabs/providers/server'

/**
 * Providers TaleLabs offers on managed (credit) execution. Adding a provider
 * here is a deliberate policy decision: the worker runtime must be able to
 * resolve that provider's platform credential. Which of these serves a given
 * model on credits is decided per model by catalog binding priority.
 */
export const MANAGED_PLATFORM_PROVIDERS: ReadonlySet<CatalogProviderId>
  = new Set<CatalogProviderId>(['fal', 'openrouter'])

/** Secret-safe readiness probe used while admitting managed provider work. */
export type ManagedProviderCredentialReadiness = (
  provider: CatalogProviderId,
) => boolean

/**
 * Resolves the providers usable for admitting one run in the given mode.
 *
 * Managed runs use TaleLabs' platform-provider policy. Browser BYOK runs use the
 * providers the user has connected a key for, supplied by the run request.
 * Missing browser readiness information fails closed for live admission.
 *
 * @param executionRuntime - Where the authenticated request is sent from.
 * @param byokProviders - Providers the user connected a browser key for.
 * @param managedCredentialReady - Secret-safe managed credential readiness.
 * @returns The provider set passed to `selectProviderBinding`.
 */
export function availableProvidersForRun(
  executionRuntime: 'browser' | 'managed',
  byokProviders?: readonly CatalogProviderId[],
  managedCredentialReady: ManagedProviderCredentialReadiness
    = hasManagedProviderCredential,
): ReadonlySet<CatalogProviderId> {
  if (executionRuntime === 'managed') {
    return new Set(
      [...MANAGED_PLATFORM_PROVIDERS].filter(managedCredentialReady),
    )
  }
  return new Set<CatalogProviderId>(byokProviders ?? [])
}
