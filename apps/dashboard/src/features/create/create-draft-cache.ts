/**
 * Same-tab recovery for browser-local Create session drafts.
 *
 * The cache is scoped by tenant, authenticated user, and durable session ID
 * (or the unsaved `new` route). It never contains a Flow, graph, revision,
 * provider binding, or credential.
 */

import type { CreateDraft } from './create-draft'

const inMemoryDrafts = new Map<string, CreateDraft>()
const CACHE_PREFIX = 'talelabs.createDraft.v2.'

function cacheKey(input: {
  createSessionId: null | string
  organizationId: string
  userId: string
}) {
  return [
    input.organizationId,
    input.userId,
    input.createSessionId ?? 'new',
  ].join('.')
}

/** Reads the same-tab draft for one new or durable Create session. */
export function readCreateDraftCache(input: {
  /** Durable Create session identity, or null for the unsaved route. */
  createSessionId: null | string
  /** Active organization owning referenced Assets. */
  organizationId: string
  /** Authenticated user owning browser-local recovery state. */
  userId: string
}): CreateDraft | null {
  const key = cacheKey(input)
  const memory = inMemoryDrafts.get(key)
  if (memory)
    return structuredClone(memory)
  try {
    const serialized = sessionStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!serialized)
      return null
    const draft = JSON.parse(serialized) as CreateDraft
    inMemoryDrafts.set(key, draft)
    return structuredClone(draft)
  }
  catch {
    return null
  }
}

/** Writes only the bounded provider-neutral draft to same-tab storage. */
export function writeCreateDraftCache(input: {
  /** Durable Create session identity, or null for the unsaved route. */
  createSessionId: null | string
  /** Current direct request draft. */
  draft: CreateDraft
  /** Active organization owning referenced Assets. */
  organizationId: string
  /** Authenticated user owning browser-local recovery state. */
  userId: string
}) {
  const key = cacheKey(input)
  const draft = structuredClone(input.draft)
  inMemoryDrafts.set(key, draft)
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(draft))
  }
  catch {
    // In-memory recovery remains available for this tab.
  }
}

/** Removes one promoted or discarded browser-local session draft. */
export function deleteCreateDraftCache(input: {
  /** Durable Create session identity, or null for the unsaved route. */
  createSessionId: null | string
  /** Active organization owning referenced Assets. */
  organizationId: string
  /** Authenticated user owning browser-local recovery state. */
  userId: string
}) {
  const key = cacheKey(input)
  inMemoryDrafts.delete(key)
  try {
    sessionStorage.removeItem(`${CACHE_PREFIX}${key}`)
  }
  catch {
    // The in-memory copy was still removed.
  }
}
