export function toNullableText(value: string) {
  return value.trim() || null
}

export function toOptionalText(value: string) {
  return value.trim() || undefined
}
