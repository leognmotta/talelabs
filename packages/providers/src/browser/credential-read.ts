/** Read-only browser credential status and executor-resolution operations. */

import type {
  BrowserCredentialScope,
  BrowserCredentialStatus,
} from './credential-contracts.js'

import {
  BROWSER_CREDENTIAL_STORE_ERROR,
  BROWSER_CREDENTIAL_STORE_NAME,
  BROWSER_CREDENTIAL_USER_INDEX_NAME,
} from './credential-contracts.js'
import { decryptBrowserCredential } from './credential-crypto.js'
import {
  browserCredentialRequestResult,
  browserCredentialTransactionDone,
  openBrowserCredentialDatabase,
} from './credential-database.js'
import { readBrowserEncryptionKey } from './credential-key.js'
import { parseStoredBrowserCredentialRecord } from './credential-records.js'
import {
  assertBrowserCredentialScope,
  assertBrowserCredentialUserId,
} from './credential-scope.js'

/** Resolves plaintext only inside the browser-local provider executor. */
export async function resolveCredential(
  scope: BrowserCredentialScope,
): Promise<string | null> {
  assertBrowserCredentialScope(scope)
  const database = await openBrowserCredentialDatabase()

  try {
    const transaction = database.transaction(
      BROWSER_CREDENTIAL_STORE_NAME,
      'readonly',
    )
    const request = transaction
      .objectStore(BROWSER_CREDENTIAL_STORE_NAME)
      .get([scope.userId, scope.providerId])
    const [value] = await Promise.all([
      browserCredentialRequestResult<unknown>(request),
      browserCredentialTransactionDone(transaction),
    ])
    if (value === undefined)
      return null

    const record = parseStoredBrowserCredentialRecord(value, scope)
    const key = await readBrowserEncryptionKey(database)
    if (!key)
      throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)

    return await decryptBrowserCredential(record, key)
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }
  finally {
    database.close()
  }
}

/** Lists non-secret provider statuses for one authenticated browser user. */
export async function listCredentialStatuses({
  userId,
}: {
  userId: string
}): Promise<BrowserCredentialStatus[]> {
  assertBrowserCredentialUserId(userId)
  const database = await openBrowserCredentialDatabase()

  try {
    const transaction = database.transaction(
      BROWSER_CREDENTIAL_STORE_NAME,
      'readonly',
    )
    const request = transaction
      .objectStore(BROWSER_CREDENTIAL_STORE_NAME)
      .index(BROWSER_CREDENTIAL_USER_INDEX_NAME)
      .getAll(IDBKeyRange.only(userId))
    const [values] = await Promise.all([
      browserCredentialRequestResult<unknown[]>(request),
      browserCredentialTransactionDone(transaction),
    ])
    const records = values.map(value => (
      parseStoredBrowserCredentialRecord(value)
    ))
    if (records.some(record => record.userId !== userId))
      throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)

    if (records.length > 0 && !await readBrowserEncryptionKey(database))
      throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)

    return records
      .map(record => ({ providerId: record.providerId, stored: true as const }))
      .toSorted((left, right) => left.providerId.localeCompare(right.providerId))
  }
  catch {
    throw new Error(BROWSER_CREDENTIAL_STORE_ERROR)
  }
  finally {
    database.close()
  }
}
