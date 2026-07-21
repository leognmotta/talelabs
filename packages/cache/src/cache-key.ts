/** Collision-safe namespaced cache-key construction. */

/** Primitive facts accepted by the shared cache-key encoder. */
export type CacheKeyPart = boolean | number | string

function encodePart(part: CacheKeyPart): string {
  return encodeURIComponent(String(part))
}

/** Builds one readable key whose namespace and parts cannot collide on separators. */
export function createCacheKey(
  namespace: string,
  parts: readonly CacheKeyPart[],
): string {
  if (!namespace.trim())
    throw new Error('Cache key namespace must not be empty.')
  return [namespace, ...parts].map(encodePart).join(':')
}
