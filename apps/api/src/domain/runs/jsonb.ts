/** PostgreSQL JSONB insertion boundary for validated run values. */

import type { JsonValue } from '@talelabs/db'

import { sql } from '@talelabs/db'

/** Wraps an already validated JSON value for PostgreSQL JSONB insertion. */
export function jsonb(value: JsonValue): JsonValue {
  return sql`${JSON.stringify(value)}::jsonb` as unknown as JsonValue
}
