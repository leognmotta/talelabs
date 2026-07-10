import { Buffer } from 'node:buffer'

interface CursorPayload {
  createdAt: string
  id: string
}

export interface PageCursor {
  createdAt: Date
  id: string
}

export function encodeCursor(cursor: PageCursor) {
  const payload: CursorPayload = {
    createdAt: cursor.createdAt.toISOString(),
    id: cursor.id,
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeCursor(value: string | undefined) {
  if (!value)
    return { ok: true, cursor: null } as const

  try {
    const payload = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<CursorPayload>
    const createdAt = new Date(payload.createdAt ?? '')

    if (!payload.id || Number.isNaN(createdAt.getTime()))
      return { ok: false } as const

    return {
      ok: true,
      cursor: {
        createdAt,
        id: payload.id,
      },
    } as const
  }
  catch {
    return { ok: false } as const
  }
}
