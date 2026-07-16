/**
 * Parsed and immutable current generation model catalog.
 *
 * Importing this module fails closed when JSON structure or cross-record
 * invariants drift. It performs no network, database, or provider work.
 *
 */

import { ModelCatalogSchema } from './catalog-schema.js'
import { RAW_MODEL_CATALOG } from './catalog-source.js'
import { validateModelCatalog } from './catalog-validation.js'

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object')
    return value
  for (const child of Object.values(value))
    deepFreeze(child)
  return Object.freeze(value)
}

const parsedCatalog = ModelCatalogSchema.parse(RAW_MODEL_CATALOG)
const startupErrors = validateModelCatalog(parsedCatalog)
if (startupErrors.length) {
  throw new Error(`Invalid model catalog:\n${startupErrors.join('\n')}`)
}

/** Deeply frozen checked-in catalog used by server and product readers. */
export const MODEL_CATALOG = deepFreeze(parsedCatalog)

/** Deeply frozen current model records in source order. */
export const MODEL_CATALOG_MODELS = MODEL_CATALOG.models

/**
 * Resolves a current model by canonical creative identity.
 *
 * @param modelId - Canonical `vendor/model` ID.
 * @returns The immutable model record, or `undefined` when it is unknown.
 */
export function getCatalogModel(modelId: string) {
  return MODEL_CATALOG_MODELS.find(model => model.id === modelId)
}
