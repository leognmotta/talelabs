const PRESENTATION_ONLY_SNAPSHOT_KEYS = new Set([
  'dragging',
  'label',
  'position',
  'positionabsolute',
  'positionx',
  'positiony',
  'reactstate',
  'selected',
])

function isForbiddenSnapshotKey(key: string) {
  return key.includes('credential')
    || key.includes('apikey')
    || key.endsWith('url')
    || key.endsWith('storagekey')
    || key.endsWith('rawbytes')
    || PRESENTATION_ONLY_SNAPSHOT_KEYS.has(key)
}

export function assertSafeSnapshotValue(
  value: unknown,
  path = '$',
  ancestors = new WeakSet<object>(),
) {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError(`snapshot_non_finite_number:${path}`)
    return
  }
  if (typeof value !== 'object')
    throw new TypeError(`snapshot_non_json_value:${path}`)
  if (ancestors.has(value))
    throw new TypeError(`snapshot_cycle:${path}`)
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        assertSafeSnapshotValue(entry, `${path}.${index}`, ancestors))
      return
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError(`snapshot_non_json_value:${path}`)
    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = key.replaceAll(/[^a-z]/gi, '').toLowerCase()
      if (isForbiddenSnapshotKey(normalizedKey))
        throw new TypeError(`snapshot_forbidden_field:${path}.${key}`)
      assertSafeSnapshotValue(nested, `${path}.${key}`, ancestors)
    }
  }
  finally {
    ancestors.delete(value)
  }
}
