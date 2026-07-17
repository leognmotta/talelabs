/** AES-GCM encryption for browser-only provider credentials. */

import type {
  BrowserCredentialScope,
  EncryptedBrowserCredential,
  StoredBrowserCredentialRecord,
} from './credential-contracts.js'

import {
  BROWSER_CREDENTIAL_SCHEMA_VERSION,
  BROWSER_CREDENTIAL_STORE_ERROR,
} from './credential-contracts.js'

/** Encodes immutable credential ownership as AES-GCM authenticated data. */
export function createBrowserCredentialAdditionalData(
  scope: BrowserCredentialScope,
): Uint8Array<ArrayBuffer> {
  const value = JSON.stringify({
    providerId: scope.providerId,
    schemaVersion: BROWSER_CREDENTIAL_SCHEMA_VERSION,
    userId: scope.userId,
  })
  return new TextEncoder().encode(value)
}

/** Encrypts one credential with a unique 96-bit IV and authenticated scope. */
export async function encryptBrowserCredential(
  credential: string,
  scope: BrowserCredentialScope,
  key: CryptoKey,
): Promise<EncryptedBrowserCredential> {
  try {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      {
        additionalData: createBrowserCredentialAdditionalData(scope),
        iv,
        name: 'AES-GCM',
        tagLength: 128,
      },
      key,
      new TextEncoder().encode(credential),
    )

    return { ciphertext, iv }
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }
}

/** Decrypts a validated credential only for the reserved browser executor API. */
export async function decryptBrowserCredential(
  record: StoredBrowserCredentialRecord,
  key: CryptoKey,
): Promise<string> {
  try {
    const plaintext = await globalThis.crypto.subtle.decrypt(
      {
        additionalData: createBrowserCredentialAdditionalData(record),
        iv: record.iv,
        name: 'AES-GCM',
        tagLength: 128,
      },
      key,
      record.ciphertext,
    )
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }
}
