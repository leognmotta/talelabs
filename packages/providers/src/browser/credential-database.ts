/** IndexedDB schema creation and request lifecycle primitives. */

import {
  BROWSER_CREDENTIAL_DATABASE_NAME,
  BROWSER_CREDENTIAL_DATABASE_VERSION,
  BROWSER_CREDENTIAL_STORE_ERROR,
  BROWSER_CREDENTIAL_STORE_NAME,
  BROWSER_CREDENTIAL_USER_INDEX_NAME,
  BROWSER_ENCRYPTION_KEY_STORE_NAME,
} from './credential-contracts.js'

/** Opens the browser credential database and creates its versioned stores. */
export function openBrowserCredentialDatabase(): Promise<IDBDatabase> {
  if (
    typeof globalThis.indexedDB === 'undefined'
    || typeof globalThis.IDBKeyRange === 'undefined'
    || typeof globalThis.CryptoKey === 'undefined'
    || !globalThis.crypto?.subtle
  ) {
    return Promise.reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
  }

  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    let rejected = false
    try {
      request = globalThis.indexedDB.open(
        BROWSER_CREDENTIAL_DATABASE_NAME,
        BROWSER_CREDENTIAL_DATABASE_VERSION,
      )
    }
    catch {
      reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
      return
    }

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(BROWSER_ENCRYPTION_KEY_STORE_NAME)) {
        database.createObjectStore(BROWSER_ENCRYPTION_KEY_STORE_NAME, {
          keyPath: 'id',
        })
      }

      if (!database.objectStoreNames.contains(BROWSER_CREDENTIAL_STORE_NAME)) {
        const credentialStore = database.createObjectStore(
          BROWSER_CREDENTIAL_STORE_NAME,
          { keyPath: ['userId', 'providerId'] },
        )
        credentialStore.createIndex(
          BROWSER_CREDENTIAL_USER_INDEX_NAME,
          'userId',
          { unique: false },
        )
      }
    }
    request.onerror = () => {
      rejected = true
      reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
    }
    request.onblocked = () => {
      rejected = true
      reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
    }
    request.onsuccess = () => {
      const database = request.result
      if (rejected) {
        database.close()
        return
      }

      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

/** Converts one IndexedDB request into a fixed-error promise result. */
export function browserCredentialRequestResult<T>(
  request: IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
    request.onsuccess = () => resolve(request.result)
  })
}

/** Resolves only after an IndexedDB transaction commits successfully. */
export function browserCredentialTransactionDone(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onabort = () => reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
    transaction.onerror = () => reject(new Error(BROWSER_CREDENTIAL_STORE_ERROR))
    transaction.oncomplete = () => resolve()
  })
}
