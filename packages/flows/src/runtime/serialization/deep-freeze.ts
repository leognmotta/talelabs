export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object' || seen.has(value))
    return value
  seen.add(value)
  if (Array.isArray(value))
    value.forEach(entry => deepFreeze(entry, seen))
  else
    Object.values(value).forEach(entry => deepFreeze(entry, seen))
  return Object.freeze(value)
}
