/** Shared Kysely column and PostgreSQL JSON contracts. */

import type { ColumnType } from 'kysely'

/** Scalar values accepted by PostgreSQL JSON columns. */
export type JsonPrimitive = boolean | null | number | string

/** Recursive values accepted by PostgreSQL JSON columns. */
export type JsonValue = JsonArray | JsonObject | JsonPrimitive

/** Recursive JSON array contract. */
export interface JsonArray extends Array<JsonValue> {}

/** Recursive JSON object contract. */
export interface JsonObject {
  [key: string]: JsonValue | undefined
}

/** Timestamp supplied explicitly on insert and update. */
export type Timestamp = ColumnType<Date, Date | string, Date | string>

/** Database-authored timestamp that remains writable after insertion. */
export type GeneratedTimestamp = ColumnType<
  Date,
  Date | string | undefined,
  Date | string
>

/** Nullable lifecycle timestamp with an omitted insert value. */
export type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>

/** JSON value with a database-owned insert default. */
export type GeneratedJsonColumn = ColumnType<
  JsonValue,
  JsonValue | string | undefined,
  JsonValue | string
>

/** Bigint returned as a string with a database-owned insert default. */
export type GeneratedBigIntColumn = ColumnType<
  string,
  bigint | number | string | undefined,
  bigint | number | string
>

/** Nullable bigint returned as a string. */
export type NullableBigIntColumn = ColumnType<
  string | null,
  bigint | number | string | null | undefined,
  bigint | number | string | null
>

/** Nullable exact numeric returned as a string. */
export type NullableNumericColumn = ColumnType<
  string | null,
  number | string | null | undefined,
  number | string | null
>
