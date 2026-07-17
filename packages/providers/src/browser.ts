/** Browser-safe protocol and encrypted credential-storage public subpath. */

export type {
  BrowserCredentialProviderId,
  BrowserCredentialScope,
  BrowserCredentialStatus,
  StoreBrowserCredentialInput,
} from './browser/credential-contracts.js'
export {
  listCredentialStatuses,
  resolveCredential,
} from './browser/credential-read.js'
export {
  clearUserCredentials,
  removeCredential,
  storeCredential,
} from './browser/credential-write.js'
export * from './core.js'
