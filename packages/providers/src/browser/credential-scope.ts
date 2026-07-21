/** Validation for authenticated browser credential ownership scopes. */

import type {
  BrowserCredentialProviderId,
  BrowserCredentialScope,
} from './credential-contracts.js'

import {
  BROWSER_CREDENTIAL_STORE_ERROR,
  isBrowserCredentialProviderId,
} from './credential-contracts.js'

/** Rejects empty or malformed immutable Better Auth user identifiers. */
export function assertBrowserCredentialUserId(userId: string): void {
  if (typeof userId !== 'string' || userId.trim().length === 0)
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
}

/** Rejects credential scopes outside the supported browser provider set. */
export function assertBrowserCredentialScope(
  scope: BrowserCredentialScope,
): void {
  assertBrowserCredentialUserId(scope.userId)

  if (!isBrowserCredentialProviderId(scope.providerId))
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
}

/**
 * Lists captured run providers whose browser credential is not currently
 * available. Inputs contain provider identifiers only and never key material.
 */
export function missingBrowserCredentialProviders(
  requiredProviders: readonly BrowserCredentialProviderId[],
  connectedProviders: readonly BrowserCredentialProviderId[],
): BrowserCredentialProviderId[] {
  const connected = new Set(connectedProviders)
  return [...new Set(requiredProviders)]
    .filter(provider => !connected.has(provider))
    .toSorted()
}
