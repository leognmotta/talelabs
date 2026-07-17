/** Browser credential storage contracts and immutable schema identifiers. */

/** Current browser credential record and authenticated-data schema version. */
export const BROWSER_CREDENTIAL_SCHEMA_VERSION = 1 as const

/** IndexedDB database name reserved for provider credentials. */
export const BROWSER_CREDENTIAL_DATABASE_NAME = 'talelabs-provider-credentials'

/** Current IndexedDB schema version for provider credentials. */
export const BROWSER_CREDENTIAL_DATABASE_VERSION = 1

/** IndexedDB object store containing encrypted provider credentials. */
export const BROWSER_CREDENTIAL_STORE_NAME = 'credentials'

/** IndexedDB object store containing the non-extractable encryption key. */
export const BROWSER_ENCRYPTION_KEY_STORE_NAME = 'encryptionKeys'

/** Index used to enumerate credential statuses for one authenticated user. */
export const BROWSER_CREDENTIAL_USER_INDEX_NAME = 'byUserId'

/** Stable key used for the browser profile's single encryption key record. */
export const BROWSER_ENCRYPTION_KEY_ID = 'browser-master-key'

/** Generic non-secret failure code for every browser credential operation. */
export const BROWSER_CREDENTIAL_STORE_ERROR = 'browser_credential_store_unavailable'

/** Providers currently eligible for browser-only credential persistence. */
export type BrowserCredentialProviderId = 'openrouter'

/** Immutable owner and provider scope bound into AES-GCM authenticated data. */
export interface BrowserCredentialScope {
  /** Immutable Better Auth user ID that owns the credential. */
  userId: string
  /** Provider whose authenticated requests may use the credential. */
  providerId: BrowserCredentialProviderId
}

/** Input accepted when encrypting and storing one provider credential. */
export interface StoreBrowserCredentialInput extends BrowserCredentialScope {
  /** Plaintext credential retained only for the duration of encryption. */
  credential: string
}

/** Non-secret persistence status returned to browser settings surfaces. */
export interface BrowserCredentialStatus {
  /** Provider with an encrypted credential in the current browser profile. */
  providerId: BrowserCredentialProviderId
  /** Always true because absent providers are omitted from status results. */
  stored: true
}

/** Encrypted IndexedDB record validated before any decrypt operation. */
export interface StoredBrowserCredentialRecord extends BrowserCredentialScope {
  /** Schema version included in the AES-GCM authenticated data. */
  schemaVersion: typeof BROWSER_CREDENTIAL_SCHEMA_VERSION
  /** Unique 96-bit AES-GCM initialization vector for this write. */
  iv: Uint8Array<ArrayBuffer>
  /** AES-GCM ciphertext including its authentication tag. */
  ciphertext: ArrayBuffer
}

/** Structured-cloned IndexedDB record for the browser encryption key. */
export interface StoredBrowserEncryptionKeyRecord {
  /** Stable singleton record identifier. */
  id: typeof BROWSER_ENCRYPTION_KEY_ID
  /** Schema version governing the key algorithm and usages. */
  schemaVersion: typeof BROWSER_CREDENTIAL_SCHEMA_VERSION
  /** Non-extractable 256-bit AES-GCM key persisted by structured clone. */
  key: CryptoKey
}

/** Ciphertext material produced before a credential record is persisted. */
export interface EncryptedBrowserCredential {
  /** Unique 96-bit AES-GCM initialization vector for this write. */
  iv: Uint8Array<ArrayBuffer>
  /** AES-GCM ciphertext including its authentication tag. */
  ciphertext: ArrayBuffer
}
