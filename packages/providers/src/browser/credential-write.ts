/** Browser credential persistence, removal, and sign-out cleanup operations. */

import type {
  BrowserCredentialScope,
  StoreBrowserCredentialInput,
  StoredBrowserCredentialRecord,
} from './credential-contracts.js'

import {
  BROWSER_CREDENTIAL_SCHEMA_VERSION,
  BROWSER_CREDENTIAL_STORE_ERROR,
  BROWSER_CREDENTIAL_STORE_NAME,
  BROWSER_CREDENTIAL_USER_INDEX_NAME,
} from './credential-contracts.js'
import { encryptBrowserCredential } from './credential-crypto.js'
import {
  browserCredentialRequestResult,
  browserCredentialTransactionDone,
  openBrowserCredentialDatabase,
} from './credential-database.js'
import { getOrCreateBrowserEncryptionKey } from './credential-key.js'
import {
  assertBrowserCredentialScope,
  assertBrowserCredentialUserId,
} from './credential-scope.js'

/** Encrypts and inserts or replaces one user-scoped provider credential. */
export async function storeCredential(
  input: StoreBrowserCredentialInput,
): Promise<void> {
  assertBrowserCredentialScope(input)
  if (typeof input.credential !== 'string' || input.credential.length === 0)
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)

  const database = await openBrowserCredentialDatabase()
  try {
    const key = await getOrCreateBrowserEncryptionKey(database)
    const encrypted = await encryptBrowserCredential(input.credential, input, key)
    const record: StoredBrowserCredentialRecord = {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      providerId: input.providerId,
      schemaVersion: BROWSER_CREDENTIAL_SCHEMA_VERSION,
      userId: input.userId,
    }
    const transaction = database.transaction(
      BROWSER_CREDENTIAL_STORE_NAME,
      'readwrite',
    )
    const request = transaction
      .objectStore(BROWSER_CREDENTIAL_STORE_NAME)
      .put(record)
    await Promise.all([
      browserCredentialRequestResult(request),
      browserCredentialTransactionDone(transaction),
    ])
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }
  finally {
    database.close()
  }
}

/** Removes one encrypted credential without resolving its plaintext value. */
export async function removeCredential(
  scope: BrowserCredentialScope,
): Promise<void> {
  assertBrowserCredentialScope(scope)
  const database = await openBrowserCredentialDatabase()

  try {
    const transaction = database.transaction(
      BROWSER_CREDENTIAL_STORE_NAME,
      'readwrite',
    )
    const request = transaction
      .objectStore(BROWSER_CREDENTIAL_STORE_NAME)
      .delete([scope.userId, scope.providerId])
    await Promise.all([
      browserCredentialRequestResult(request),
      browserCredentialTransactionDone(transaction),
    ])
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }
  finally {
    database.close()
  }
}

/** Deletes every locally stored provider credential owned by one user. */
export async function clearUserCredentials({
  userId,
}: {
  userId: string
}): Promise<void> {
  assertBrowserCredentialUserId(userId)
  const database = await openBrowserCredentialDatabase()

  try {
    const transaction = database.transaction(
      BROWSER_CREDENTIAL_STORE_NAME,
      'readwrite',
    )
    const credentialStore = transaction.objectStore(
      BROWSER_CREDENTIAL_STORE_NAME,
    )
    const request = credentialStore
      .index(BROWSER_CREDENTIAL_USER_INDEX_NAME)
      .openKeyCursor(IDBKeyRange.only(userId))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor)
        return

      try {
        credentialStore.delete(cursor.primaryKey)
        cursor.continue()
      }
      catch {
        transaction.abort()
      }
    }
    await browserCredentialTransactionDone(transaction)
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }
  finally {
    database.close()
  }
}
