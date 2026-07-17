/** Strict validation for untrusted browser credential database records. */

import type {
  BrowserCredentialScope,
  StoredBrowserCredentialRecord,
  StoredBrowserEncryptionKeyRecord,
} from './credential-contracts.js'

import {
  BROWSER_CREDENTIAL_SCHEMA_VERSION,
  BROWSER_CREDENTIAL_STORE_ERROR,
  BROWSER_ENCRYPTION_KEY_ID,
} from './credential-contracts.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validates an encrypted record and its expected authenticated owner scope. */
export function parseStoredBrowserCredentialRecord(
  value: unknown,
  expectedScope?: BrowserCredentialScope,
): StoredBrowserCredentialRecord {
  if (
    !isRecord(value)
    || value.schemaVersion !== BROWSER_CREDENTIAL_SCHEMA_VERSION
    || typeof value.userId !== 'string'
    || value.userId.trim().length === 0
    || value.providerId !== 'openrouter'
    || !(value.iv instanceof Uint8Array)
    || value.iv.byteLength !== 12
    || !(value.ciphertext instanceof ArrayBuffer)
    || value.ciphertext.byteLength === 0
    || (expectedScope !== undefined && (
      value.userId !== expectedScope.userId
      || value.providerId !== expectedScope.providerId
    ))
  ) {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }

  return {
    ciphertext: value.ciphertext,
    iv: new Uint8Array(value.iv),
    providerId: value.providerId,
    schemaVersion: value.schemaVersion,
    userId: value.userId,
  }
}

/** Validates the structured-cloned non-extractable AES-GCM key record. */
export function parseStoredBrowserEncryptionKeyRecord(
  value: unknown,
): StoredBrowserEncryptionKeyRecord {
  if (!isRecord(value) || !(value.key instanceof CryptoKey))
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)

  const algorithm = value.key.algorithm as AesKeyAlgorithm
  const usages = value.key.usages

  if (
    value.id !== BROWSER_ENCRYPTION_KEY_ID
    || value.schemaVersion !== BROWSER_CREDENTIAL_SCHEMA_VERSION
    || value.key.type !== 'secret'
    || value.key.extractable
    || algorithm.name !== 'AES-GCM'
    || algorithm.length !== 256
    || usages.length !== 2
    || !usages.includes('encrypt')
    || !usages.includes('decrypt')
  ) {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }

  return {
    id: value.id,
    key: value.key,
    schemaVersion: value.schemaVersion,
  }
}
