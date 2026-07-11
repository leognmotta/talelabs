import { z } from 'zod'

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/i

export function focusedText(maximum: number) {
  return z.string()
    .trim()
    .max(maximum, 'validation.maxLength')
}

export function hexColor() {
  return z.string()
    .trim()
    .transform(value => value.startsWith('#') ? value : `#${value}`)
    .pipe(z.string().regex(HEX_COLOR_PATTERN, 'validation.hexColor'))
    .transform(value => value.toUpperCase())
}
