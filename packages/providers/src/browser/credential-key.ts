/** Lifecycle for the browser profile's non-extractable encryption key. */

import type { StoredBrowserEncryptionKeyRecord } from './credential-contracts.js'

import {
  BROWSER_CREDENTIAL_SCHEMA_VERSION,
  BROWSER_CREDENTIAL_STORE_ERROR,
  BROWSER_ENCRYPTION_KEY_ID,
  BROWSER_ENCRYPTION_KEY_STORE_NAME,
} from './credential-contracts.js'
import {
  browserCredentialRequestResult,
  browserCredentialTransactionDone,
} from './credential-database.js'
import { parseStoredBrowserEncryptionKeyRecord } from './credential-records.js'

/** Reads and validates the persisted encryption key when one exists. */
export async function readBrowserEncryptionKey(
  database: IDBDatabase,
): Promise<CryptoKey | null> {
  const transaction = database.transaction(
    BROWSER_ENCRYPTION_KEY_STORE_NAME,
    'readonly',
  )
  const request = transaction
    .objectStore(BROWSER_ENCRYPTION_KEY_STORE_NAME)
    .get(BROWSER_ENCRYPTION_KEY_ID)
  const [value] = await Promise.all([
    browserCredentialRequestResult<unknown>(request),
    browserCredentialTransactionDone(transaction),
  ])

  if (value === undefined)
    return null

  return parseStoredBrowserEncryptionKeyRecord(value).key
}

/** Adds a generated singleton key without overwriting a concurrent winner. */
export async function tryAddBrowserEncryptionKey(
  database: IDBDatabase,
  record: StoredBrowserEncryptionKeyRecord,
): Promise<boolean> {
  const transaction = database.transaction(
    BROWSER_ENCRYPTION_KEY_STORE_NAME,
    'readwrite',
  )
  const request = transaction
    .objectStore(BROWSER_ENCRYPTION_KEY_STORE_NAME)
    .add(record)
  const added = new Promise<boolean>((resolve, reject) => {
    request.onsuccess = () => resolve(true)
    request.onerror = (event) => {
      if (request.error?.name === 'ConstraintError') {
        event.preventDefault()
        event.stopPropagation()
        resolve(false)
        return
      }

      reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
    }
  })
  const [wasAdded] = await Promise.all([
    added,
    browserCredentialTransactionDone(transaction),
  ])
  return wasAdded
}

/** Returns the existing key or atomically establishes the first generated key. */
export async function getOrCreateBrowserEncryptionKey(
  database: IDBDatabase,
): Promise<CryptoKey> {
  const existingKey = await readBrowserEncryptionKey(database)
  if (existingKey)
    return existingKey

  let generatedKey: CryptoKey
  try {
    generatedKey = await globalThis.crypto.subtle.generateKey(
      { length: 256, name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    )
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }

  if (!(generatedKey instanceof CryptoKey))
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)

  const wasAdded = await tryAddBrowserEncryptionKey(database, {
    id: BROWSER_ENCRYPTION_KEY_ID,
    key: generatedKey,
    schemaVersion: BROWSER_CREDENTIAL_SCHEMA_VERSION,
  })
  if (wasAdded)
    return generatedKey

  const concurrentKey = await readBrowserEncryptionKey(database)
  if (!concurrentKey)
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)

  return concurrentKey
}
