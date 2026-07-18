/** Non-secret IndexedDB recovery hints for browser execution progress. */

import type { BrowserRunRecoveryEntry } from '@talelabs/flows'

import { BrowserRunRecoveryEntrySchema } from '@talelabs/flows'
import { openDB } from 'idb'

const DATABASE_NAME = 'talelabs-browser-run-recovery'
const STORE_NAME = 'entries'
const DATABASE_VERSION = 2

async function openJournal() {
  return openDB(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database, oldVersion) {
      if (
        oldVersion < DATABASE_VERSION
        && database.objectStoreNames.contains(STORE_NAME)
      ) {
        database.deleteObjectStore(STORE_NAME)
      }
      if (!database.objectStoreNames.contains(STORE_NAME))
        database.createObjectStore(STORE_NAME)
    },
  })
}

function checkpointKey(entry: BrowserRunRecoveryEntry) {
  return [
    entry.organizationId,
    entry.userId,
    entry.runId,
    entry.jobId ?? 'run',
  ].join(':')
}

/** Replaces one safe recovery hint after strict secret-free validation. */
export async function writeBrowserRunJournal(entry: BrowserRunRecoveryEntry) {
  const database = await openJournal()
  try {
    const parsed = BrowserRunRecoveryEntrySchema.parse(entry)
    await database.put(STORE_NAME, parsed, checkpointKey(parsed))
  }
  finally {
    database.close()
  }
}

/** Removes a terminal run hint; PostgreSQL remains authoritative throughout. */
export async function clearBrowserRunJournal(runId: string) {
  const database = await openJournal()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    let cursor = await transaction.store.openCursor()
    while (cursor) {
      const parsed = BrowserRunRecoveryEntrySchema.safeParse(cursor.value)
      if (!parsed.success || parsed.data.runId === runId)
        await cursor.delete()
      cursor = await cursor.continue()
    }
    await transaction.done
  }
  finally {
    database.close()
  }
}

/** Removes one completed job checkpoint without disturbing concurrent jobs. */
export async function clearBrowserJobJournal(runId: string, jobId: string) {
  const database = await openJournal()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    let cursor = await transaction.store.openCursor()
    while (cursor) {
      const parsed = BrowserRunRecoveryEntrySchema.safeParse(cursor.value)
      if (
        !parsed.success
        || (parsed.data.runId === runId && parsed.data.jobId === jobId)
      ) {
        await cursor.delete()
      }
      cursor = await cursor.continue()
    }
    await transaction.done
  }
  finally {
    database.close()
  }
}

/** Reads strictly validated checkpoints for one authenticated browser scope. */
export async function readBrowserRunJournal(
  organizationId: string,
  userId: string,
) {
  const database = await openJournal()
  try {
    const entries = await database.getAll(STORE_NAME)
    return entries.flatMap((entry) => {
      const parsed = BrowserRunRecoveryEntrySchema.safeParse(entry)
      return parsed.success
        && parsed.data.organizationId === organizationId
        && parsed.data.userId === userId
        ? [parsed.data]
        : []
    })
  }
  finally {
    database.close()
  }
}

/** Rewrites matching checkpoints before background suspension. */
export async function touchBrowserRunJournal(
  organizationId: string,
  userId: string,
) {
  const entries = await readBrowserRunJournal(organizationId, userId)
  const updatedAt = new Date().toISOString()
  await Promise.all(
    entries.map(entry => writeBrowserRunJournal({ ...entry, updatedAt })),
  )
}

/** Removes all non-secret recovery records owned by a signed-out user. */
export async function clearUserBrowserRunJournal(userId: string) {
  const database = await openJournal()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    let cursor = await transaction.store.openCursor()
    while (cursor) {
      const parsed = BrowserRunRecoveryEntrySchema.safeParse(cursor.value)
      if (!parsed.success || parsed.data.userId === userId)
        await cursor.delete()
      cursor = await cursor.continue()
    }
    await transaction.done
  }
  finally {
    database.close()
  }
}
