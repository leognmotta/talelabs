import { Buffer } from 'node:buffer'
import { isCuid } from '@paralleldrive/cuid2'

export type CursorSortValue = null | number | string
export type SortOrder = 'asc' | 'desc'

export interface PageCursor<Sort extends string = string> {
  id: string
  order: SortOrder
  sort: Sort
  sortValue: CursorSortValue
}

interface VersionedCursorPayload extends PageCursor {
  version: 1
}

export type DecodeCursorResult<Sort extends string = string>
  = | { cursor: PageCursor<Sort>, ok: true }
    | { ok: false, reason: 'invalid_cursor' }

const BASE64_URL_PATTERN = /^[\w-]+$/
const MAX_CURSOR_LENGTH = 2048

function isCursorSortValue(value: unknown): value is CursorSortValue {
  return value === null || typeof value === 'number' || typeof value === 'string'
}

function isVersionedCursorPayload(value: unknown): value is VersionedCursorPayload {
  if (!value || typeof value !== 'object')
    return false

  const payload = value as Partial<VersionedCursorPayload>

  return payload.version === 1
    && typeof payload.sort === 'string'
    && payload.sort.length > 0
    && (payload.order === 'asc' || payload.order === 'desc')
    && isCursorSortValue(payload.sortValue)
    && typeof payload.id === 'string'
    && isCuid(payload.id)
}

export function encodeCursor<Sort extends string>(cursor: PageCursor<Sort>) {
  const payload: VersionedCursorPayload = {
    version: 1,
    ...cursor,
  }

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function decodeCursor<Sort extends string = string>(
  value: string,
): DecodeCursorResult<Sort> {
  if (
    value.length === 0
    || value.length > MAX_CURSOR_LENGTH
    || !BASE64_URL_PATTERN.test(value)
  ) {
    return { ok: false, reason: 'invalid_cursor' }
  }

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    )

    if (!isVersionedCursorPayload(payload))
      return { ok: false, reason: 'invalid_cursor' }

    return {
      cursor: {
        id: payload.id,
        order: payload.order,
        sort: payload.sort as Sort,
        sortValue: payload.sortValue,
      },
      ok: true,
    }
  }
  catch {
    return { ok: false, reason: 'invalid_cursor' }
  }
}
