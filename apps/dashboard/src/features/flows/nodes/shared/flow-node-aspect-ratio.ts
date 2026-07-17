/** Parses catalog aspect-ratio values such as `16:9`, rejecting invalid dimensions. */
export function readAspectRatio(value: unknown) {
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 ? value : null

  if (typeof value !== 'string')
    return null

  const normalized = value.trim()
  const separator = normalized.includes(':')
    ? ':'
    : normalized.includes('/')
      ? '/'
      : null

  if (!separator) {
    const numericValue = Number(normalized)
    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : null
  }

  const [width, height] = normalized.split(separator).map(Number)
  return width
    && height
    && Number.isFinite(width)
    && Number.isFinite(height)
    && width > 0
    && height > 0
    ? width / height
    : null
}

/** Returns a finite width/height ratio when both media dimensions are positive. */
export function aspectRatioFromDimensions(
  width: null | number | undefined,
  height: null | number | undefined,
) {
  return width && height && width > 0 && height > 0
    ? width / height
    : null
}
