/**
 * Product-controlled Element vocabulary shared by the API and dashboard.
 *
 * An Element is a named, ordered collection of reference image Assets. `kind`
 * is presentation-only: it selects an icon and a library filter and never
 * changes validation, forms, or runtime behavior. Adding a kind is a
 * registry change here plus localized labels; it never requires a migration.
 */

/** Stable persisted Element kind identifiers. */
export const ELEMENT_KINDS = [
  'character',
  'prop',
  'location',
  'style',
  'other',
] as const

/** One product-controlled Element kind label. */
export type ElementKind = (typeof ELEMENT_KINDS)[number]

/** Maximum reference images one Element may hold. */
export const MAX_ELEMENT_REFERENCES = 8

/** Reports whether a persisted value is a registered Element kind. */
export function isElementKind(value: unknown): value is ElementKind {
  return typeof value === 'string'
    && (ELEMENT_KINDS as readonly string[]).includes(value)
}
