import type { JsonObject, JsonValue } from '@talelabs/db'

function isJsonObject(value: JsonValue | null): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function mergeAssetMetadata(
  existing: JsonValue | null,
  processed: JsonValue,
): JsonValue {
  if (!isJsonObject(existing) || !isJsonObject(processed))
    return processed
  return { ...existing, ...processed }
}
