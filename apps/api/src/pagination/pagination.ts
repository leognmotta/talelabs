import type { ErrorDetail } from '../middleware/error.js'
import type {
  CursorSortValue,
  PageCursor,
  SortOrder,
} from './cursor.js'

import { decodeCursor, encodeCursor } from './cursor.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export interface PaginationInput<Sort extends string> {
  cursor?: string
  limit?: number
  order?: SortOrder
  sort?: Sort
}

export interface PaginationConfig<Sort extends string> {
  cursorValueParsers: Record<Sort, CursorValueParser>
  defaultOrder?: SortOrder
  defaultSort: Sort
}

export type CursorValueParser<Value extends CursorSortValue = CursorSortValue>
  = (value: CursorSortValue) => undefined | Value

export interface ResolvedPagination<Sort extends string> {
  cursor: PageCursor<Sort> | null
  limit: number
  order: SortOrder
  sort: Sort
}

export type ResolvePaginationResult<Sort extends string>
  = | { details: ErrorDetail[], ok: false }
    | { ok: true, value: ResolvedPagination<Sort> }

function validationDetail(
  code: string,
  field: string,
  message: string,
): ErrorDetail {
  return { code, field, message }
}

function getCursorValueParser<Sort extends string>(
  config: PaginationConfig<Sort>,
  sort: string,
) {
  if (!Object.hasOwn(config.cursorValueParsers, sort))
    return undefined

  return config.cursorValueParsers[sort as Sort]
}

export const parseStringCursorValue: CursorValueParser<string> = (value) => {
  return typeof value === 'string' ? value : undefined
}

export const parseNumberCursorValue: CursorValueParser<number> = (value) => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined
}

export const parseNullableNumberCursorValue: CursorValueParser<null | number>
  = (value) => {
    return value === null ? null : parseNumberCursorValue(value)
  }

export const parseIsoTimestampCursorValue: CursorValueParser<string>
  = (value) => {
    if (typeof value !== 'string')
      return undefined

    const date = new Date(value)

    if (Number.isNaN(date.getTime()))
      return undefined

    const normalized = date.toISOString()

    return normalized === value ? normalized : undefined
  }

export function resolvePagination<Sort extends string>(
  input: PaginationInput<Sort>,
  config: PaginationConfig<Sort>,
): ResolvePaginationResult<Sort> {
  if (!getCursorValueParser(config, config.defaultSort))
    throw new Error('Pagination defaultSort must have a cursor value parser.')

  const limit = input.limit ?? DEFAULT_LIMIT

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return {
      details: [validationDetail(
        'invalid_limit',
        'limit',
        `Limit must be an integer between 1 and ${MAX_LIMIT}.`,
      )],
      ok: false,
    }
  }

  if (input.sort && !getCursorValueParser(config, input.sort)) {
    return {
      details: [validationDetail(
        'invalid_sort',
        'sort',
        'Sort is not supported for this resource.',
      )],
      ok: false,
    }
  }

  if (input.order && input.order !== 'asc' && input.order !== 'desc') {
    return {
      details: [validationDetail(
        'invalid_order',
        'order',
        'Order must be asc or desc.',
      )],
      ok: false,
    }
  }

  if (!input.cursor) {
    return {
      ok: true,
      value: {
        cursor: null,
        limit,
        order: input.order ?? config.defaultOrder ?? 'desc',
        sort: input.sort ?? config.defaultSort,
      },
    }
  }

  const decoded = decodeCursor<Sort>(input.cursor)

  if (!decoded.ok) {
    return {
      details: [validationDetail(
        'invalid_cursor',
        'cursor',
        'Cursor is invalid or no longer supported.',
      )],
      ok: false,
    }
  }

  const parseCursorValue = getCursorValueParser(config, decoded.cursor.sort)

  if (!parseCursorValue) {
    return {
      details: [validationDetail(
        'invalid_cursor',
        'cursor',
        'Cursor is invalid or no longer supported.',
      )],
      ok: false,
    }
  }

  if (input.sort && input.sort !== decoded.cursor.sort) {
    return {
      details: [validationDetail(
        'cursor_sort_mismatch',
        'sort',
        'Sort must match the cursor.',
      )],
      ok: false,
    }
  }

  if (input.order && input.order !== decoded.cursor.order) {
    return {
      details: [validationDetail(
        'cursor_order_mismatch',
        'order',
        'Order must match the cursor.',
      )],
      ok: false,
    }
  }

  const parsedCursorValue = parseCursorValue(decoded.cursor.sortValue)

  if (parsedCursorValue === undefined) {
    return {
      details: [validationDetail(
        'invalid_cursor_value',
        'cursor',
        'Cursor value does not match its sort.',
      )],
      ok: false,
    }
  }

  const cursor: PageCursor<Sort> = {
    ...decoded.cursor,
    sortValue: parsedCursorValue,
  }

  return {
    ok: true,
    value: {
      cursor,
      limit,
      order: cursor.order,
      sort: cursor.sort,
    },
  }
}

export function buildCursorPage<Row, Output, Sort extends string>(options: {
  cursorFromRow: (row: Row) => PageCursor<Sort>
  limit: number
  rows: Row[]
  serialize: (row: Row) => Output
}) {
  const hasNextPage = options.rows.length > options.limit
  const pageRows = hasNextPage
    ? options.rows.slice(0, options.limit)
    : options.rows
  const lastRow = pageRows.at(-1)

  return {
    data: pageRows.map(options.serialize),
    nextCursor: hasNextPage && lastRow
      ? encodeCursor(options.cursorFromRow(lastRow))
      : null,
    pageRows,
  }
}
