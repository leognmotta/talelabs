import { encodeCursor } from '../../data/cursor.js'

interface CursorRow {
  createdAt: Date
  id: string
}

export const invalidCursorResult = {
  ok: false,
  reason: 'invalid_cursor',
} as const

export function buildCursorPage<Row extends CursorRow, Output>(
  rows: Row[],
  limit: number,
  serialize: (row: Row) => Output,
) {
  const hasNextPage = rows.length > limit
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows
  const lastRow = pageRows.at(-1)

  return {
    data: pageRows.map(serialize),
    nextCursor: hasNextPage && lastRow
      ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
      : null,
    pageRows,
  }
}
