/** Validation for authenticated browser credential ownership scopes. */

import type { BrowserCredentialScope } from './credential-contracts.js'

import { BROWSER_CREDENTIAL_STORE_ERROR } from './credential-contracts.js'

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

  if (scope.providerId !== 'openrouter')
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
}
