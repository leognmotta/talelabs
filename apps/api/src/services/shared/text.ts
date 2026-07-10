export function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined)
    return undefined

  return value?.trim() || null
}

export function normalizeTextList(values: string[] | undefined) {
  return values?.map(value => value.trim()).filter(Boolean)
}
